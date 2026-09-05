import { z } from 'zod';

import { ATTACHMENT_TYPES } from '@shared/enums';
import { isFdiTooth } from '@shared/constants/dental';
import { paginationQuerySchema } from '@shared/schemas/common';

/** Upload ceiling per file; CBCT volumes are the reason it is not smaller. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

/** Only formats the clinic actually stores — an allow-list, never a deny-list. */
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/dicom',
  'application/pdf',
] as const;

export const attachmentMimeSchema = z.enum(ALLOWED_ATTACHMENT_MIME_TYPES);
export type AttachmentMime = z.infer<typeof attachmentMimeSchema>;

/**
 * Attachment metadata. The R2 object key never leaves the API — a caller
 * receives a short-lived signed URL instead, and a receptionist receives
 * neither (ROLES.md field rules).
 */
export const attachmentSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid(),
  visitId: z.uuid().nullable(),
  type: z.enum(ATTACHMENT_TYPES),
  filename: z.string(),
  mime: attachmentMimeSchema,
  sizeBytes: z.number().int().positive(),
  tooth: z.number().int().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Short-lived, regenerated per request; absent in list responses. */
  downloadUrl: z.url().optional(),
  downloadUrlExpiresAt: z.iso.datetime().optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const presignAttachmentUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: attachmentMimeSchema,
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  type: z.enum(ATTACHMENT_TYPES),
});
export type PresignAttachmentUploadInput = z.infer<typeof presignAttachmentUploadSchema>;

export const presignAttachmentUploadResponseSchema = z.object({
  /** Opaque to the client; it is echoed back on confirm. */
  key: z.string(),
  uploadUrl: z.url(),
  expiresAt: z.iso.datetime(),
  maxSizeBytes: z.number().int().positive(),
});
export type PresignAttachmentUploadResponse = z.infer<typeof presignAttachmentUploadResponseSchema>;

/**
 * Called once the client has PUT the object. Size and MIME are read back from
 * storage rather than trusted from this body.
 */
export const confirmAttachmentUploadSchema = z.object({
  key: z.string().trim().min(1).max(512),
  type: z.enum(ATTACHMENT_TYPES),
  filename: z.string().trim().min(1).max(255),
  visitId: z.uuid().nullish(),
  tooth: z.number().int().refine(isFdiTooth, 'Not a valid FDI tooth number').nullish(),
  note: z.string().trim().max(1000).nullish(),
});
export type ConfirmAttachmentUploadInput = z.infer<typeof confirmAttachmentUploadSchema>;

export const listAttachmentsQuerySchema = paginationQuerySchema.extend({
  visitId: z.uuid().optional(),
  type: z.enum(ATTACHMENT_TYPES).optional(),
  tooth: z.coerce.number().int().optional(),
});
export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuerySchema>;
