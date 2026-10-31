import { z } from "zod";
import { isMobilePhone } from "@shared/constants/phone";
import { WHATSAPP_STATUSES } from "@shared/enums";
import { phoneSchema } from "@shared/schemas/common";

export const whatsAppCheckRequestSchema = z.object({
  phone: phoneSchema,
});

export type WhatsAppCheckRequest = z.infer<typeof whatsAppCheckRequestSchema>;

export const whatsAppCheckSchema = z.object({
  phone: z.string(),
  status: z.enum(WHATSAPP_STATUSES),
  checking: z.boolean(),
  checkedAt: z.string().nullable(),
});

export type WhatsAppCheck = z.infer<typeof whatsAppCheckSchema>;

export const isCheckablePhone = (phone: string | null | undefined): phone is string =>
  typeof phone === "string" && isMobilePhone(phone);
