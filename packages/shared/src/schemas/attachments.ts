import { z } from "zod";
import { isFdiTooth } from "@shared/constants/dental";
import { paginationQuerySchema } from "@shared/schemas/common";
import { lookupCodeSchema } from "@shared/schemas/lookups";

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "application/dicom",
  "application/pdf",
] as const;

export const attachmentMimeSchema = z.enum(ALLOWED_ATTACHMENT_MIME_TYPES);
export type AttachmentMime = z.infer<typeof attachmentMimeSchema>;

export const attachmentSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid(),
  visitId: z.uuid().nullable(),
  type: lookupCodeSchema.nullable(),
  filename: z.string(),
  mime: attachmentMimeSchema,
  sizeBytes: z.number().int().positive(),
  tooth: z.number().int().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  downloadUrl: z.url().optional(),
  downloadUrlExpiresAt: z.iso.datetime().optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const presignAttachmentUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: attachmentMimeSchema,
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  type: lookupCodeSchema.nullish(),
});
export type PresignAttachmentUploadInput = z.infer<typeof presignAttachmentUploadSchema>;

export const presignAttachmentUploadResponseSchema = z.object({
  key: z.string(),
  uploadUrl: z.url(),
  expiresAt: z.iso.datetime(),
  maxSizeBytes: z.number().int().positive(),
});
export type PresignAttachmentUploadResponse = z.infer<typeof presignAttachmentUploadResponseSchema>;

export const confirmAttachmentUploadSchema = z.object({
  key: z.string().trim().min(1).max(512),
  type: lookupCodeSchema.nullish(),
  filename: z.string().trim().min(1).max(255),
  visitId: z.uuid().nullish(),
  tooth: z.number().int().refine(isFdiTooth, "Not a valid FDI tooth number").nullish(),
  note: z.string().trim().max(1000).nullish(),
});
export type ConfirmAttachmentUploadInput = z.infer<typeof confirmAttachmentUploadSchema>;

export const listAttachmentsQuerySchema = paginationQuerySchema.extend({
  visitId: z.uuid().optional(),
  type: lookupCodeSchema.optional(),
  tooth: z.coerce.number().int().optional(),
});
export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuerySchema>;
