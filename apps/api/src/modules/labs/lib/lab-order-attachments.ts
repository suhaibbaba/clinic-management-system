import { labOrderAttachments } from "@api/database/schema";
import { ALLOWED_ATTACHMENT_MIME_TYPES } from "@clinic/shared";

export type AttachmentRow = typeof labOrderAttachments.$inferSelect;

export const isAllowedMime = (mime: string | undefined): mime is string =>
  mime !== undefined && (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mime);
