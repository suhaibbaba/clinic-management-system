import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";
import {
  LOOKUP_LIST,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type ConfirmAttachmentUploadInput,
  type ListAttachmentsQuery,
  type Paginated,
  type PresignAttachmentUploadInput,
  type PresignAttachmentUploadResponse,
} from "@clinic/shared";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/audit/services/audit-snapshot.registry";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { attachments, visits } from "@api/database/schema";
import { PatientAccessService } from "@api/patients/services/patient-access.service";
import { StorageService } from "@api/storage/services/storage.service";
import { LookupsService } from "@api/lookups/services/lookups.service";
import { ATTACHMENTS_ENTITY, UNTYPED_CATEGORY } from "@api/patients/constants";
import { toAttachment, AttachmentRow, assertAllowedMime } from "@api/patients/lib/attachments";

@Injectable()
export class AttachmentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
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

      return row ? { ...toAttachment(row), r2Key: row.r2Key } : null;
    });
  }

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

  async findOne(actor: AuthenticatedUser, id: string): Promise<Attachment> {
    const row = await this.patientAccess.requireRow<AttachmentRow>(actor, attachments, id);
    const download = await this.storage.createDownloadUrl(row.r2Key, row.filename);

    return {
      ...toAttachment(row),
      downloadUrl: download.url,
      downloadUrlExpiresAt: download.expiresAt.toISOString(),
    };
  }

  async presignUpload(
    actor: AuthenticatedUser,
    patientId: string,
    input: PresignAttachmentUploadInput,
  ): Promise<PresignAttachmentUploadResponse> {
    await this.patientAccess.requirePatientId(actor, patientId);
    if (input.type) {
      await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.ATTACHMENT_TYPE, input.type);
    }

    const key = this.storage.buildPatientObjectKey({
      clinicId: actor.clinicId,
      patientId,
      category: input.type ?? UNTYPED_CATEGORY,
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

  async confirmUpload(
    actor: AuthenticatedUser,
    patientId: string,
    input: ConfirmAttachmentUploadInput,
  ): Promise<Attachment> {
    await this.patientAccess.requirePatientId(actor, patientId);
    if (input.type) {
      await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.ATTACHMENT_TYPE, input.type);
    }

    if (!this.storage.isKeyOwnedBy(input.key, actor.clinicId, patientId)) {
      throw new BadRequestException("This key does not belong to this patient");
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
      throw new ConflictException("This upload has already been confirmed");
    }

    const stored = await this.storage.statObject(input.key);
    if (!stored) {
      throw new BadRequestException("No uploaded file found for this key");
    }

    const mime = assertAllowedMime(stored.mime);
    if (!mime || stored.sizeBytes <= 0 || stored.sizeBytes > MAX_ATTACHMENT_BYTES) {
      await this.storage.deleteObject(input.key);
      throw new BadRequestException(
        mime ? "Uploaded file size is outside the allowed range" : "Unsupported file type",
      );
    }

    const [row] = await this.db
      .insert(attachments)
      .values({
        clinicId: actor.clinicId,
        patientId,
        visitId: input.visitId ?? null,
        type: input.type ?? null,
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

    if (!row) {
      throw new Error("Failed to record attachment");
    }

    return toAttachment(row);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.patientAccess.requireRow<AttachmentRow>(actor, attachments, id);
    const now = new Date();

    await this.db
      .update(attachments)
      .set({ deletedAt: now, updatedAt: now, updatedBy: actor.id })
      .where(this.scope.where(attachments, actor.clinicId, eq(attachments.id, id)));
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
      throw new BadRequestException("Visit not found for this patient");
    }
  }
}
