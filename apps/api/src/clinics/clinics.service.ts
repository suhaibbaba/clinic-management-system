import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import {
  ALLOWED_CLINIC_LOGO_MIME_TYPES,
  CLINIC_ICONS,
  MAX_APP_SHORT_NAME_LENGTH,
  MAX_CLINIC_ICON_BYTES,
  MAX_CLINIC_LOGO_BYTES,
  clinicIcon,
  type Clinic,
  type ClinicBranding,
  type ClinicManifest,
  type ConfirmClinicAppIconInput,
  type ConfirmClinicLogoInput,
  type DocumentSettings,
  type PresignClinicAppIconInput,
  type PresignClinicIconsResponse,
  type PresignClinicLogoInput,
  type PresignClinicLogoResponse,
  type UpdateClinicInput,
} from "@clinic/shared";
import { documentSettings } from "@clinic/shared";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics } from "@api/database/schema";
import { StorageService } from "@api/storage/storage.service";

type ClinicRow = typeof clinics.$inferSelect;

export const CLINICS_ENTITY = "clinics";

const LOGO_CATEGORY = "branding";

/** Derived, never stored: the icons are always under the key of the image they were rendered from. */
const iconKey = (sourceKey: string, name: string): string => `${sourceKey}/icons/${name}`;

/** A wordmark has no legible 16px form, so a clinic may supply a square to render the icons from. */
/** Whatever a home screen should read, in the clinic's own document language. */
function appName(row: { nameAr: string; nameEn: string; settings: unknown } | undefined): string {
  if (!row) {
    return "";
  }

  const language: DocumentSettings["language"] = documentSettings(row.settings).language;

  return language === "ar" ? row.nameAr : row.nameEn;
}

const iconSource = (row: { logoKey: string | null; appIconKey: string | null }): string | null =>
  row.appIconKey ?? row.logoKey;

// `clinics` is the one table without a `clinic_id` — it is the tenant — so scoping is `id =
// caller.clinicId` rather than `ClinicScopeService`.
@Injectable()
export class ClinicsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(CLINICS_ENTITY, async (id, clinicId) => {
      if (id !== clinicId) {
        return null;
      }

      const row = await this.findOwn(clinicId);

      // The key is audited rather than the signed URL, which would make every entry unreadable
      // once it expired.
      return row ? { ...toClinic(row), logoUrl: null } : null;
    });
  }

  async get(actor: AuthenticatedUser): Promise<Clinic> {
    return this.withLogoUrl(await this.findOwnOrFail(actor.clinicId));
  }

  // Answered only when this deployment serves exactly one clinic: with several, a stranger cannot
  // say which they mean, and the same silence hides how many exist.
  async branding(): Promise<ClinicBranding> {
    const rows = await this.db
      .select({
        nameAr: clinics.nameAr,
        nameEn: clinics.nameEn,
        settings: clinics.settings,
        logoKey: clinics.logoKey,
        logoIconsAt: clinics.logoIconsAt,
      })
      .from(clinics)
      .where(isNull(clinics.deletedAt))
      .limit(2);

    const [only] = rows;

    if (rows.length !== 1 || !only) {
      return { name: null, logoUrl: null, iconsAt: null, appName: "" };
    }

    return {
      name: { ar: only.nameAr, en: only.nameEn },
      logoUrl: await this.signLogo(only.logoKey),
      iconsAt: only.logoIconsAt?.toISOString() ?? null,
      appName: appName(only),
    };
  }

  // A home screen shows one label, so the clinic's own document language picks it rather than the
  // reader's — the same rule a printed sheet follows.
  async manifest(): Promise<ClinicManifest> {
    const rows = await this.db
      .select({
        nameAr: clinics.nameAr,
        nameEn: clinics.nameEn,
        settings: clinics.settings,
        logoKey: clinics.logoKey,
        appIconKey: clinics.appIconKey,
        logoIconsAt: clinics.logoIconsAt,
      })
      .from(clinics)
      .where(isNull(clinics.deletedAt))
      .limit(2);

    const only = rows.length === 1 ? rows[0] : undefined;
    const language = only ? documentSettings(only.settings).language : "ar";
    const name = appName(only);
    const version = only?.logoIconsAt?.toISOString();

    return {
      name,
      short_name: name.slice(0, MAX_APP_SHORT_NAME_LENGTH).trim(),
      lang: language,
      dir: language === "ar" ? "rtl" : "ltr",
      start_url: "/",
      scope: "/",
      display: "standalone",
      // Installability wants a 192 and a 512; without a rendered set there are none to offer, and
      // the browser declines to install rather than being handed a broken address.
      icons:
        version === undefined
          ? []
          : CLINIC_ICONS.filter((icon) => icon.size >= 192).map((icon) => ({
              src: `/api/clinic/icon/${icon.name}?v=${encodeURIComponent(version)}`,
              sizes: `${icon.size}x${icon.size}`,
              type: icon.mime,
              purpose: icon.purpose,
            })),
    };
  }

  // The same single-clinic rule as `branding`, for the same reason: a stranger asking a
  // multi-clinic deployment for "the" tab mark has not named which one.
  async iconUrl(name: string): Promise<string | null> {
    const icon = clinicIcon(name);

    if (!icon) {
      return null;
    }

    const rows = await this.db
      .select({
        logoKey: clinics.logoKey,
        appIconKey: clinics.appIconKey,
        logoIconsAt: clinics.logoIconsAt,
      })
      .from(clinics)
      .where(isNull(clinics.deletedAt))
      .limit(2);

    const [only] = rows;
    const source = only ? iconSource(only) : null;

    if (rows.length !== 1 || !source || only?.logoIconsAt == null) {
      return null;
    }

    return (await this.storage.createBrandingUrl(iconKey(source, icon.name))).url;
  }

  // The key is built from the caller's own clinic id, never taken from the request, so an upload
  // can only land under the clinic signing for it.
  async presignLogo(
    actor: AuthenticatedUser,
    input: PresignClinicLogoInput,
  ): Promise<PresignClinicLogoResponse> {
    await this.findOwnOrFail(actor.clinicId);

    const key = this.storage.buildClinicObjectKey({
      clinicId: actor.clinicId,
      category: LOGO_CATEGORY,
      filename: input.filename,
    });

    const upload = await this.storage.createUploadUrl(key, input.mime);

    return {
      key: upload.key,
      uploadUrl: upload.uploadUrl,
      expiresAt: upload.expiresAt.toISOString(),
      maxSizeBytes: MAX_CLINIC_LOGO_BYTES,
    };
  }

  async presignAppIcon(
    actor: AuthenticatedUser,
    input: PresignClinicAppIconInput,
  ): Promise<PresignClinicLogoResponse> {
    return this.presignLogo(actor, input);
  }

  async confirmLogo(actor: AuthenticatedUser, input: ConfirmClinicLogoInput): Promise<Clinic> {
    const existing = await this.findOwnOrFail(actor.clinicId);

    await this.verifyUploadedImage(input.key, actor.clinicId);

    return this.replaceSource(actor, existing, { logoKey: input.key });
  }

  async removeLogo(actor: AuthenticatedUser): Promise<Clinic> {
    return this.replaceSource(actor, await this.findOwnOrFail(actor.clinicId), { logoKey: null });
  }

  async confirmAppIcon(
    actor: AuthenticatedUser,
    input: ConfirmClinicAppIconInput,
  ): Promise<Clinic> {
    const existing = await this.findOwnOrFail(actor.clinicId);

    await this.verifyUploadedImage(input.key, actor.clinicId);

    return this.replaceSource(actor, existing, { appIconKey: input.key });
  }

  async removeAppIcon(actor: AuthenticatedUser): Promise<Clinic> {
    return this.replaceSource(actor, await this.findOwnOrFail(actor.clinicId), {
      appIconKey: null,
    });
  }

  // The icons belong to whichever image they were rendered from, so changing either picture drops
  // the set and leaves the tab on the product mark until the client re-renders it.
  private async replaceSource(
    actor: AuthenticatedUser,
    existing: ClinicRow,
    change: { logoKey?: string | null; appIconKey?: string | null },
  ): Promise<Clinic> {
    const before = iconSource(existing);
    const unchanged = before === iconSource({ ...existing, ...change });
    const row = await this.writeBranding(actor, change, unchanged ? "keep" : "clear");

    const replaced = [
      change.logoKey !== undefined && existing.logoKey !== change.logoKey ? existing.logoKey : null,
      change.appIconKey !== undefined && existing.appIconKey !== change.appIconKey
        ? existing.appIconKey
        : null,
    ].filter((key): key is string => key !== null);

    for (const key of replaced) {
      await this.discardSource(key);
    }

    // An app icon arriving over a logo leaves the logo in place but retires the set rendered from
    // it, which nothing above would have swept up.
    if (!unchanged && before !== null && !replaced.includes(before)) {
      await this.discardIcons(before);
    }

    return this.withLogoUrl(row);
  }

  /** Slots under the current source, so re-rendering is the same call whichever picture changed. */
  async presignIcons(actor: AuthenticatedUser): Promise<PresignClinicIconsResponse> {
    const row = await this.findOwnOrFail(actor.clinicId);
    const source = iconSource(row);

    if (!source) {
      throw new BadRequestException("There is no logo or app icon to render icons from");
    }

    const icons = await Promise.all(
      CLINIC_ICONS.map(async (icon) => ({
        name: icon.name,
        mime: icon.mime,
        uploadUrl: (await this.storage.createUploadUrl(iconKey(source, icon.name), icon.mime))
          .uploadUrl,
      })),
    );

    return {
      sourceUrl: (await this.storage.createBrandingUrl(source)).url,
      icons,
      maxIconSizeBytes: MAX_CLINIC_ICON_BYTES,
    };
  }

  async confirmIcons(actor: AuthenticatedUser): Promise<Clinic> {
    const row = await this.findOwnOrFail(actor.clinicId);
    const source = iconSource(row);

    if (!source) {
      throw new BadRequestException("There is no logo or app icon to render icons from");
    }

    if ((await this.inspectIcons(source)) !== "complete") {
      await this.discardIcons(source);
      throw new BadRequestException("The generated icon set is incomplete or invalid");
    }

    return this.withLogoUrl(await this.writeBranding(actor, {}, "verified"));
  }

  async update(actor: AuthenticatedUser, input: UpdateClinicInput): Promise<Clinic> {
    await this.findOwnOrFail(actor.clinicId);

    const [row] = await this.db
      .update(clinics)
      .set({
        ...(input.name !== undefined && { nameAr: input.name.ar, nameEn: input.name.en }),
        ...(input.phone !== undefined && { phone: input.phone ?? null }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.address !== undefined && { address: input.address ?? null }),
        ...(input.latitude !== undefined && { latitude: input.latitude ?? null }),
        ...(input.longitude !== undefined && { longitude: input.longitude ?? null }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.country !== undefined && { country: input.country }),
        ...(input.workingHours !== undefined && { workingHours: input.workingHours }),
        ...(input.settings !== undefined && { settings: input.settings }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(and(eq(clinics.id, actor.clinicId), isNull(clinics.deletedAt)))
      .returning();

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return this.withLogoUrl(row);
  }

  // Size and type are read back from storage rather than trusted, and anything outside the limits
  // is deleted instead of pointed at.
  private async verifyUploadedImage(key: string, clinicId: string): Promise<void> {
    if (!this.storage.isClinicKeyOwnedBy(key, clinicId, LOGO_CATEGORY)) {
      throw new BadRequestException("This key does not belong to this clinic");
    }

    const stored = await this.storage.statObject(key);

    if (!stored) {
      throw new BadRequestException("No uploaded file found for this key");
    }

    const isImage = ALLOWED_CLINIC_LOGO_MIME_TYPES.some((mime) => mime === stored.mime);

    if (!isImage || stored.sizeBytes <= 0 || stored.sizeBytes > MAX_CLINIC_LOGO_BYTES) {
      await this.storage.deleteObject(key);
      throw new BadRequestException(
        isImage ? "Uploaded file size is outside the allowed range" : "Unsupported file type",
      );
    }
  }

  // All or nothing, and a logo may arrive with none: a browser that generated no icons still gets
  // its logo and falls back to the product mark, but half a set is a failure the admin should see.
  private async inspectIcons(logoKey: string): Promise<"complete" | "none" | "partial"> {
    const stored = await Promise.all(
      CLINIC_ICONS.map(async (icon) => {
        const object = await this.storage.statObject(iconKey(logoKey, icon.name));

        return (
          object !== null &&
          object.mime === icon.mime &&
          object.sizeBytes > 0 &&
          object.sizeBytes <= MAX_CLINIC_ICON_BYTES
        );
      }),
    );

    if (stored.every(Boolean)) {
      return "complete";
    }

    return stored.some(Boolean) ? "partial" : "none";
  }

  private async discardSource(sourceKey: string): Promise<void> {
    await Promise.all([this.storage.deleteObject(sourceKey), this.discardIcons(sourceKey)]);
  }

  private async discardIcons(sourceKey: string): Promise<void> {
    await Promise.all(
      CLINIC_ICONS.map((icon) => this.storage.deleteObject(iconKey(sourceKey, icon.name))),
    );
  }

  private async writeBranding(
    actor: AuthenticatedUser,
    change: { logoKey?: string | null; appIconKey?: string | null },
    icons: "keep" | "clear" | "verified",
  ): Promise<ClinicRow> {
    const [row] = await this.db
      .update(clinics)
      .set({
        ...change,
        ...(icons === "clear" ? { logoIconsAt: null } : {}),
        ...(icons === "verified" ? { logoIconsAt: new Date() } : {}),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(and(eq(clinics.id, actor.clinicId), isNull(clinics.deletedAt)))
      .returning();

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  // The stored key never leaves the API; the client gets a signed URL that is stable for a window,
  // so the rail's logo is a cache hit on every page after the first.
  private async withLogoUrl(row: ClinicRow): Promise<Clinic> {
    const [logoUrl, appIconUrl] = await Promise.all([
      this.signLogo(row.logoKey),
      this.signLogo(row.appIconKey),
    ]);

    return { ...toClinic(row), logoUrl, appIconUrl };
  }

  private async signLogo(key: string | null): Promise<string | null> {
    return key ? (await this.storage.createBrandingUrl(key)).url : null;
  }

  private async findOwn(clinicId: string): Promise<ClinicRow | undefined> {
    const [row] = await this.db
      .select()
      .from(clinics)
      .where(and(eq(clinics.id, clinicId), isNull(clinics.deletedAt)))
      .limit(1);

    return row;
  }

  private async findOwnOrFail(clinicId: string): Promise<ClinicRow> {
    const row = await this.findOwn(clinicId);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row;
  }
}

function toClinic(row: ClinicRow): Omit<Clinic, "logoUrl" | "appIconUrl"> {
  return {
    id: row.id,
    name: { ar: row.nameAr, en: row.nameEn },
    logoKey: row.logoKey,
    appIconKey: row.appIconKey,
    logoIconsAt: row.logoIconsAt?.toISOString() ?? null,
    phone: row.phone,
    email: row.email,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    currency: row.currency,
    country: row.country,
    workingHours: row.workingHours,
    settings: row.settings,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
