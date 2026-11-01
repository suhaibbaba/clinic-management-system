import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  ALLOWED_CLINIC_LOGO_MIME_TYPES,
  CLINIC_MODULE,
  MAX_SITE_IMAGE_BYTES,
  SITE_SECTION,
  USER_ROLE,
  bookingSettings,
  clinicLocale,
  defaultSiteContent,
  siteContentSchema,
  siteImageKeys,
  type ClinicLocale,
  type PersonName,
  type PresignSiteImageInput,
  type PresignSiteImageResponse,
  type PublicSite,
  type PublicSiteDoctor,
  type SiteContent,
  type WebsiteEditor,
} from "@clinic/shared";
import { and, asc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { clinicChartTypes } from "@api/common/lib/clinic-charts";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { SITE_CONTENT_ENTITY } from "@api/common/constants/audit-entities";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, doctors, siteContent, specialties, users } from "@api/database/schema";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { StorageService } from "@api/modules/storage/services/storage.service";
import { ClinicsService } from "@api/modules/clinics/services/clinics.service";
import { SITE_IMAGE_CATEGORY } from "@api/modules/website/constants";
import {
  sameContent,
  siteHead,
  siteHost,
  type SiteContentRow,
} from "@api/modules/website/lib/website";

type ClinicRow = Pick<
  typeof clinics.$inferSelect,
  | "id"
  | "name"
  | "slug"
  | "logoKey"
  | "phone"
  | "country"
  | "currency"
  | "email"
  | "address"
  | "latitude"
  | "longitude"
  | "workingHours"
  | "settings"
>;

const CLINIC_COLUMNS = {
  id: clinics.id,
  name: clinics.name,
  slug: clinics.slug,
  logoKey: clinics.logoKey,
  phone: clinics.phone,
  country: clinics.country,
  currency: clinics.currency,
  email: clinics.email,
  address: clinics.address,
  latitude: clinics.latitude,
  longitude: clinics.longitude,
  workingHours: clinics.workingHours,
  settings: clinics.settings,
};

const offersWebsite = sql`${CLINIC_MODULE.WEBSITE} = any(${clinics.modules})`;

const toNumber = (value: string | null): number | null => (value === null ? null : Number(value));

const readContent = (stored: unknown): SiteContent => {
  const parsed = siteContentSchema.safeParse(stored);

  return parsed.success ? parsed.data : defaultSiteContent();
};

@Injectable()
export class WebsiteService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly clinicsService: ClinicsService,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(SITE_CONTENT_ENTITY, async (_id, clinicId) => {
      const row = await this.contentRow(clinicId);

      return row
        ? { draft: row.draft, published: row.published, publishedAt: row.publishedAt }
        : null;
    });
  }

  async editor(actor: AuthenticatedUser): Promise<WebsiteEditor> {
    const clinic = await this.clinicById(actor.clinicId);
    const row = await this.contentRow(actor.clinicId);
    const draft = row ? readContent(row.draft) : defaultSiteContent();
    const published = row?.published ? readContent(row.published) : null;

    return {
      site: await this.assemble(clinic, draft, published ? siteImageKeys(published) : []),
      publishedAt: row?.publishedAt?.toISOString() ?? null,
      unpublished: !sameContent(draft, published),
    };
  }

  async saveDraft(actor: AuthenticatedUser, content: SiteContent): Promise<WebsiteEditor> {
    const existing = await this.contentRow(actor.clinicId);
    const known = new Set([
      ...(existing ? siteImageKeys(readContent(existing.draft)) : []),
      ...(existing?.published ? siteImageKeys(readContent(existing.published)) : []),
    ]);

    for (const key of siteImageKeys(content)) {
      if (!known.has(key)) {
        await this.verifyUploadedImage(key, actor.clinicId);
      }
    }

    await this.db
      .insert(siteContent)
      .values({
        clinicId: actor.clinicId,
        draft: content,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .onConflictDoUpdate({
        target: siteContent.clinicId,
        set: { draft: content, updatedAt: new Date(), updatedBy: actor.id },
      });

    return this.editor(actor);
  }

  async publish(actor: AuthenticatedUser): Promise<WebsiteEditor> {
    const row = await this.contentRow(actor.clinicId);

    if (!row) {
      throw new BadRequestException("There is no draft to publish");
    }

    const draft = readContent(row.draft);
    const retired = row.published
      ? siteImageKeys(readContent(row.published)).filter(
          (key) => !siteImageKeys(draft).includes(key),
        )
      : [];

    await this.db
      .update(siteContent)
      .set({
        published: draft,
        publishedAt: new Date(),
        publishedBy: actor.id,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(siteContent.id, row.id));

    for (const key of retired) {
      await this.storage.deleteObject(key);
    }

    return this.editor(actor);
  }

  async presignImage(
    actor: AuthenticatedUser,
    input: PresignSiteImageInput,
  ): Promise<PresignSiteImageResponse> {
    const key = this.storage.buildClinicObjectKey({
      clinicId: actor.clinicId,
      category: SITE_IMAGE_CATEGORY,
      filename: input.filename,
    });
    const upload = await this.storage.createUploadUrl(key, input.mime);

    return {
      key: upload.key,
      uploadUrl: upload.uploadUrl,
      url: (await this.storage.createBrandingUrl(upload.key)).url,
      expiresAt: upload.expiresAt.toISOString(),
      maxSizeBytes: MAX_SITE_IMAGE_BYTES,
    };
  }

  async publicBySlug(slug: string): Promise<PublicSite> {
    return this.publicSite(await this.liveClinic(eq(clinics.slug, slug)));
  }

  async publicByHost(host: string | undefined): Promise<PublicSite> {
    return this.publicSite(await this.clinicForHost(host));
  }

  async headByHost(host: string | undefined, slug: string | undefined): Promise<string> {
    try {
      const clinic = slug
        ? await this.liveClinic(eq(clinics.slug, slug))
        : await this.clinicForHost(host);
      const [site, icons] = await Promise.all([
        this.publicSite(clinic),
        this.clinicsService.siteIconUrls(clinic.id),
      ]);

      return siteHead(site, icons);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return "";
      }

      throw error;
    }
  }

  async requirePublishedClinic(
    slug: string,
  ): Promise<{ id: string; content: SiteContent; locale: ClinicLocale }> {
    const clinic = await this.liveClinic(eq(clinics.slug, slug));
    const row = await this.contentRow(clinic.id);

    if (!row?.published) {
      throw new NotFoundException("Clinic not found");
    }

    return { id: clinic.id, content: readContent(row.published), locale: clinicLocale(clinic) };
  }

  async requirePortalClinic(slug: string): Promise<{ id: string; name: PersonName }> {
    const clinic = await this.liveClinic(eq(clinics.slug, slug));

    if (!(await this.portalOpen(clinic.id))) {
      throw new NotFoundException("Clinic not found");
    }

    return { id: clinic.id, name: clinic.name };
  }

  async portalOpen(clinicId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ published: siteContent.published })
      .from(siteContent)
      .innerJoin(clinics, eq(clinics.id, siteContent.clinicId))
      .where(and(eq(siteContent.clinicId, clinicId), isNull(clinics.deletedAt), offersWebsite))
      .limit(1);

    return Boolean(
      row?.published && readContent(row.published).sections.includes(SITE_SECTION.PORTAL),
    );
  }

  private async publicSite(clinic: ClinicRow): Promise<PublicSite> {
    const row = await this.contentRow(clinic.id);

    if (!row?.published) {
      throw new NotFoundException("Clinic not found");
    }

    const content = readContent(row.published);
    const site = await this.assemble(clinic, content, []);
    const hidden = new Set(content.doctors.hidden);

    return { ...site, doctors: site.doctors.filter((doctor) => !hidden.has(doctor.id)) };
  }

  private async assemble(
    clinic: ClinicRow,
    content: SiteContent,
    extraImages: readonly string[],
  ): Promise<PublicSite> {
    const keys = [...new Set([...siteImageKeys(content), ...extraImages])];
    const signed = await Promise.all(
      keys.map(async (key) => [key, (await this.storage.createBrandingUrl(key)).url] as const),
    );

    return {
      clinic: {
        name: clinic.name,
        slug: clinic.slug,
        logoUrl: clinic.logoKey ? (await this.storage.createBrandingUrl(clinic.logoKey)).url : null,
        phone: clinic.phone,
        country: clinic.country,
        email: clinic.email,
        address: clinic.address,
        latitude: toNumber(clinic.latitude),
        longitude: toNumber(clinic.longitude),
        workingHours: clinic.workingHours,
        bookingEnabled: bookingSettings(clinic.settings).enabled,
        chartTypes: await clinicChartTypes(this.db, clinic.id),
        locale: clinicLocale(clinic),
      },
      doctors: await this.doctors(clinic.id),
      content,
      images: Object.fromEntries(signed),
    };
  }

  private async doctors(clinicId: string): Promise<PublicSiteDoctor[]> {
    const rows = await this.db
      .select({
        id: doctors.id,
        name: users.name,
        photoKey: users.photoKey,
        specialty: specialties.name,
      })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .innerJoin(specialties, eq(specialties.id, doctors.specialtyId))
      .where(
        and(
          eq(doctors.clinicId, clinicId),
          isNull(doctors.deletedAt),
          eq(users.isActive, true),
          ne(users.role, USER_ROLE.VISITING_DOCTOR),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(users.normalizedName));

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        specialty: row.specialty,
        photoUrl: row.photoKey ? (await this.storage.createBrandingUrl(row.photoKey)).url : null,
      })),
    );
  }

  private async contentRow(clinicId: string): Promise<SiteContentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(siteContent)
      .where(eq(siteContent.clinicId, clinicId))
      .limit(1);

    return row;
  }

  private async clinicById(clinicId: string): Promise<ClinicRow> {
    const [row] = await this.db
      .select(CLINIC_COLUMNS)
      .from(clinics)
      .where(and(eq(clinics.id, clinicId), isNull(clinics.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Clinic not found");
    }

    return row;
  }

  private async liveClinic(match: SQL): Promise<ClinicRow> {
    const [row] = await this.db
      .select(CLINIC_COLUMNS)
      .from(clinics)
      .where(and(match, isNull(clinics.deletedAt), offersWebsite))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Clinic not found");
    }

    return row;
  }

  private async clinicForHost(rawHost: string | undefined): Promise<ClinicRow> {
    const host = siteHost(rawHost);

    if (host !== "") {
      const [matched] = await this.db
        .select(CLINIC_COLUMNS)
        .from(clinics)
        .where(and(eq(clinics.siteDomain, host), isNull(clinics.deletedAt), offersWebsite))
        .limit(1);

      if (matched) {
        return matched;
      }
    }

    const rows = await this.db
      .select(CLINIC_COLUMNS)
      .from(clinics)
      .where(and(isNull(clinics.deletedAt), offersWebsite))
      .limit(2);

    const [only] = rows;

    if (rows.length !== 1 || !only) {
      throw new NotFoundException("Clinic not found");
    }

    return only;
  }

  private async verifyUploadedImage(key: string, clinicId: string): Promise<void> {
    if (!this.storage.isClinicKeyOwnedBy(key, clinicId, SITE_IMAGE_CATEGORY)) {
      throw new BadRequestException("This key does not belong to this clinic");
    }

    const stored = await this.storage.statObject(key);

    if (!stored) {
      throw new BadRequestException("No uploaded file found for this key");
    }

    const isImage = ALLOWED_CLINIC_LOGO_MIME_TYPES.some((mime) => mime === stored.mime);

    if (!isImage || stored.sizeBytes <= 0 || stored.sizeBytes > MAX_SITE_IMAGE_BYTES) {
      await this.storage.deleteObject(key);
      throw new BadRequestException(
        isImage ? "Uploaded file size is outside the allowed range" : "Unsupported file type",
      );
    }
  }
}
