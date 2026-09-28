import { attachments } from "@api/database/schema";
import {
  type Attachment,
  type AttachmentMime,
  ALLOWED_ATTACHMENT_MIME_TYPES,
} from "@clinic/shared";

export type AttachmentRow = typeof attachments.$inferSelect;

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

export function assertAllowedMime(mime: string | undefined): AttachmentMime | null {
  const candidate = mime?.split(";")[0]?.trim();

  return ALLOWED_ATTACHMENT_MIME_TYPES.find((allowed) => allowed === candidate) ?? null;
}
