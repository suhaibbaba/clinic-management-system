import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  USER_ROLE,
  type Attachment,
  type AttachmentMime,
  type ConfirmAttachmentUploadInput,
  type ListAttachmentsQuery,
  type Paginated,
  type PresignAttachmentUploadInput,
  type PresignAttachmentUploadResponse,
} from '@clinic/shared';
import { desc, eq, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { attachments, visits } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';
import { StorageService } from '@api/storage/storage.service';

type AttachmentRow = typeof attachments.$inferSelect;

export const ATTACHMENTS_ENTITY = 'attachments';

/**
 * X-rays and documents on the patient file.
 *
 * Bytes never pass through the API: the client PUTs to a presigned URL and then
 * confirms, and every read hands back a short-lived signed GET instead of the
 * object key. ROLES.md forbids a receptionist any of this, so the guard on the
 * controller is the boundary and nothing here ever serialises a key.
 */
@Injectable()
export class AttachmentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly storage: StorageService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(ATTACHMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(attachments)
        .where(this.scope.where(attachments, clinicId, eq(attachments.id, id)))
        .limit(1);

      // The object key is audited: it identifies the file, and the audit log is
      // admin-only. It is the one place it appears outside the service.
      return row ? { ...toAttachment(row), r2Key: row.r2Key } : null;
    });
  }

  /** List is metadata only — a signed URL is minted per file on read. */
  async list(
    actor: AuthenticatedUser,
    patientId: string,
    query: ListAttachmentsQuery,
  ): Promise<Paginated<Attachment>> {
    await this.patientAccess.requirePatientId(actor, patientId);

    const filters: (SQL | undefined)[] = [eq(attachments.patientId, patientId)];

    if (query.visitId) {
      filters.push(eq(attachments.visitId, query.visitId));
    }
    if (query.type) {
      filters.push(eq(attachments.type, query.type));
    }
    if (query.tooth !== undefined) {
      filters.push(eq(attachments.tooth, query.tooth));
    }

    const where = this.scope.where(attachments, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(attachments)
        .where(where)
        .orderBy(desc(attachments.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(attachments)
        .where(where),
    ]);

    return toPaginated(rows.map(toAttachment), totals?.value ?? 0, query);
  }

  /** Single read: metadata plus a signed URL that expires with the configured TTL. */
  async findOne(actor: AuthenticatedUser, id: string): Promise<Attachment> {
    const row = await this.scope.findOneOrFail<AttachmentRow>(attachments, actor.clinicId, id);
    const download = await this.storage.createDownloadUrl(row.r2Key, row.filename);

    return {
      ...toAttachment(row),
      downloadUrl: download.url,
      downloadUrlExpiresAt: download.expiresAt.toISOString(),
    };
  }

  /**
   * Step 1 of an upload. The key is built here — never taken from the client —
   * so an object can only ever land under this clinic and patient.
   */
  async presignUpload(
    actor: AuthenticatedUser,
    patientId: string,
    input: PresignAttachmentUploadInput,
  ): Promise<PresignAttachmentUploadResponse> {
    await this.patientAccess.requirePatientId(actor, patientId);

    const key = this.storage.buildPatientObjectKey({
      clinicId: actor.clinicId,
      patientId,
      category: input.type,
      filename: input.filename,
    });

    const upload = await this.storage.createUploadUrl(key, input.mime);

    return {
      key: upload.key,
      uploadUrl: upload.uploadUrl,
      expiresAt: upload.expiresAt.toISOString(),
      maxSizeBytes: MAX_ATTACHMENT_BYTES,
    };
  }

  /**
   * Step 2. Size and content type are read back from storage rather than
   * trusted from the request, so a client cannot understate a file it uploaded;
   * anything outside the limits is deleted instead of being recorded.
   */
  async confirmUpload(
    actor: AuthenticatedUser,
    patientId: string,
    input: ConfirmAttachmentUploadInput,
  ): Promise<Attachment> {
    await this.patientAccess.requirePatientId(actor, patientId);

    if (!this.storage.isKeyOwnedBy(input.key, actor.clinicId, patientId)) {
      throw new BadRequestException('This key does not belong to this patient');
    }
    if (input.visitId) {
      await this.requireVisit(actor, input.visitId, patientId);
    }

    const [existing] = await this.db
      .select({ id: attachments.id })
      .from(attachments)
      .where(eq(attachments.r2Key, input.key))
      .limit(1);

    if (existing) {
      throw new ConflictException('This upload has already been confirmed');
    }

    const stored = await this.storage.statObject(input.key);
    if (!stored) {
      throw new BadRequestException('No uploaded file found for this key');
    }

    const mime = assertAllowedMime(stored.mime);
    if (!mime || stored.sizeBytes <= 0 || stored.sizeBytes > MAX_ATTACHMENT_BYTES) {
      // The object is unusable, so it is not left paying for storage.
      await this.storage.deleteObject(input.key);
      throw new BadRequestException(
        mime ? 'Uploaded file size is outside the allowed range' : 'Unsupported file type',
      );
    }

    const [row] = await this.db
      .insert(attachments)
      .values({
        clinicId: actor.clinicId,
        patientId,
        visitId: input.visitId ?? null,
        type: input.type,
        r2Key: input.key,
        filename: input.filename,
        mime,
        sizeBytes: stored.sizeBytes,
        tooth: input.tooth ?? null,
        note: input.note ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to record attachment');
    }

    return toAttachment(row);
  }

  /**
   * Soft delete only. The object itself is deliberately left in the bucket: a
   * medical image must stay recoverable by an admin (CLAUDE.md, ROLES.md rule 5).
   */
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<AttachmentRow>(attachments, actor.clinicId, id);
    const now = new Date();

    await this.db
      .update(attachments)
      .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
      .where(this.scope.where(attachments, actor.clinicId, eq(attachments.id, id)));
  }

  /** Tooth-scoped read used by the tooth-history endpoint. */
  async listForTooth(
    actor: AuthenticatedUser,
    patientId: string,
    tooth: number,
  ): Promise<Attachment[]> {
    if (actor.role === USER_ROLE.RECEPTIONIST) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(attachments)
      .where(
        this.scope.where(
          attachments,
          actor.clinicId,
          eq(attachments.patientId, patientId),
          eq(attachments.tooth, tooth),
        ),
      )
      .orderBy(desc(attachments.createdAt));

    return rows.map(toAttachment);
  }

  private async requireVisit(
    actor: AuthenticatedUser,
    visitId: string,
    patientId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: visits.id })
      .from(visits)
      .where(
        this.scope.where(
          visits,
          actor.clinicId,
          eq(visits.id, visitId),
          eq(visits.patientId, patientId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new BadRequestException('Visit not found for this patient');
    }
  }
}

/** The object key is stripped here — it never reaches a client. */
export function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    visitId: row.visitId,
    type: row.type,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    tooth: row.tooth,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Storage reports the content type it stored; only the allow-list is accepted. */
function assertAllowedMime(mime: string | undefined): AttachmentMime | null {
  const candidate = mime?.split(';')[0]?.trim();

  return ALLOWED_ATTACHMENT_MIME_TYPES.find((allowed) => allowed === candidate) ?? null;
}
