import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import {
  ALLOWED_CLINIC_LOGO_MIME_TYPES,
  MAX_CLINIC_LOGO_BYTES,
  type Clinic,
  type ClinicBranding,
  type ConfirmClinicLogoInput,
  type PresignClinicLogoInput,
  type PresignClinicLogoResponse,
  type UpdateClinicInput,
} from '@clinic/shared';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { clinics } from '@api/database/schema';
import { StorageService } from '@api/storage/storage.service';

type ClinicRow = typeof clinics.$inferSelect;

export const CLINICS_ENTITY = 'clinics';

/** The prefix the clinic's own images live under, beside `patients/`. */
const LOGO_CATEGORY = 'branding';

/**
 * The caller's own clinic.
 *
 * `clinics` is the one table without a `clinic_id` column — it *is* the tenant —
 * so scoping is `id = caller.clinicId` rather than `ClinicScopeService`. There
 * is no endpoint that takes a clinic id, so a caller can only ever reach theirs.
 */
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

      // The key is audited rather than the signed URL: the URL expires in
      // minutes and would make every log entry unreadable a day later.
      return row ? { ...toClinic(row), logoUrl: null } : null;
    });
  }

  async get(actor: AuthenticatedUser): Promise<Clinic> {
    return this.withLogoUrl(await this.findOwnOrFail(actor.clinicId));
  }

  /**
   * The clinic's name and mark for the sign-in screen, which has no caller yet.
   *
   * Answered only when this deployment serves exactly one clinic — the usual
   * case, one practice on one VPS. With several, a stranger at the login page
   * has no way to say which one they mean, and guessing would put one clinic's
   * name in front of another's staff, so this says nothing and the screen
   * falls back to the product's own mark. It is the same silence either way,
   * so the response never reveals how many clinics exist here.
   */
  async branding(): Promise<ClinicBranding> {
    const rows = await this.db
      .select({ name: clinics.name, logoKey: clinics.logoKey })
      .from(clinics)
      .where(isNull(clinics.deletedAt))
      .limit(2);

    const [only] = rows;

    if (rows.length !== 1 || !only) {
      return { name: null, logoUrl: null };
    }

    return { name: only.name, logoUrl: await this.signLogo(only.logoKey) };
  }

  /**
   * Step 1 of the logo upload: a URL the browser PUTs the image to.
   *
   * The key is built here from the caller's own clinic id, never taken from
   * the request, so an upload can only ever land under the clinic signing for
   * it. What the body carries is checked twice — here, to refuse a signature
   * for something that was never going to be accepted, and again on confirm
   * against the bytes that actually arrived.
   */
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

  /**
   * Step 2: the size and type are read back from storage rather than trusted
   * from the request, and anything outside the limits is deleted instead of
   * being pointed at from the clinic row.
   */
  async confirmLogo(actor: AuthenticatedUser, input: ConfirmClinicLogoInput): Promise<Clinic> {
    const existing = await this.findOwnOrFail(actor.clinicId);

    if (!this.storage.isClinicKeyOwnedBy(input.key, actor.clinicId, LOGO_CATEGORY)) {
      throw new BadRequestException('This key does not belong to this clinic');
    }

    const stored = await this.storage.statObject(input.key);

    if (!stored) {
      throw new BadRequestException('No uploaded file found for this key');
    }

    const isImage = ALLOWED_CLINIC_LOGO_MIME_TYPES.some((mime) => mime === stored.mime);

    if (!isImage || stored.sizeBytes <= 0 || stored.sizeBytes > MAX_CLINIC_LOGO_BYTES) {
      // Unusable, so it is not left paying for storage.
      await this.storage.deleteObject(input.key);
      throw new BadRequestException(
        isImage ? 'Uploaded file size is outside the allowed range' : 'Unsupported file type',
      );
    }

    const row = await this.setLogoKey(actor, input.key);

    // The one it replaces: a logo is a single current image, not a history,
    // and the old object has nothing left pointing at it.
    if (existing.logoKey && existing.logoKey !== input.key) {
      await this.storage.deleteObject(existing.logoKey);
    }

    return this.withLogoUrl(row);
  }

  /** Back to the product's own mark, and the object goes with it. */
  async removeLogo(actor: AuthenticatedUser): Promise<Clinic> {
    const existing = await this.findOwnOrFail(actor.clinicId);
    const row = await this.setLogoKey(actor, null);

    if (existing.logoKey) {
      await this.storage.deleteObject(existing.logoKey);
    }

    return this.withLogoUrl(row);
  }

  async update(actor: AuthenticatedUser, input: UpdateClinicInput): Promise<Clinic> {
    await this.findOwnOrFail(actor.clinicId);

    const [row] = await this.db
      .update(clinics)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone ?? null }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.address !== undefined && { address: input.address ?? null }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.workingHours !== undefined && { workingHours: input.workingHours }),
        ...(input.settings !== undefined && { settings: input.settings }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(and(eq(clinics.id, actor.clinicId), isNull(clinics.deletedAt)))
      .returning();

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new NotFoundException('Resource not found');
    }

    return this.withLogoUrl(row);
  }

  private async setLogoKey(actor: AuthenticatedUser, key: string | null): Promise<ClinicRow> {
    const [row] = await this.db
      .update(clinics)
      .set({ logoKey: key, updatedAt: new Date(), updatedBy: actor.id })
      .where(and(eq(clinics.id, actor.clinicId), isNull(clinics.deletedAt)))
      .returning();

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new NotFoundException('Resource not found');
    }

    return row;
  }

  /**
   * The stored key never leaves the API (CLAUDE.md files & images); what the
   * client gets is a signed URL that expires with the configured TTL.
   */
  private async withLogoUrl(row: ClinicRow): Promise<Clinic> {
    return { ...toClinic(row), logoUrl: await this.signLogo(row.logoKey) };
  }

  private async signLogo(key: string | null): Promise<string | null> {
    return key ? (await this.storage.createDownloadUrl(key)).url : null;
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
      throw new NotFoundException('Resource not found');
    }

    return row;
  }
}

function toClinic(row: ClinicRow): Omit<Clinic, 'logoUrl'> {
  return {
    id: row.id,
    name: row.name,
    logoKey: row.logoKey,
    phone: row.phone,
    email: row.email,
    address: row.address,
    currency: row.currency,
    workingHours: row.workingHours,
    settings: row.settings,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
