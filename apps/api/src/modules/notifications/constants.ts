import type { Reminder } from "@api/modules/notifications/lib/reminders.scheduler";
import { NOTIFICATION_TEMPLATE } from "@clinic/shared";

export const NOTIFICATION_PROVIDER = Symbol("NOTIFICATION_PROVIDER");

export const WHATSAPP_PARAMETER_LIMIT = 1000;

export const HOUR = 3_600_000;

export const MINUTE = 60_000;

export const WINDOW = 10 * MINUTE;

export const REMINDERS: readonly Reminder[] = [
  { template: NOTIFICATION_TEMPLATE.REMINDER_24H, leadMs: 24 * HOUR, setting: "remind24h" },
  { template: NOTIFICATION_TEMPLATE.REMINDER_2H, leadMs: 2 * HOUR, setting: "remind2h" },
];

export const WHATSAPP_CHECK_FRESH_MS = 30 * 24 * HOUR;

export const WHATSAPP_RESEND_AFTER_MS = 20 * MINUTE;

export const WHATSAPP_AWAIT_DELIVERY_MS = 30_000;

export const WHATSAPP_CODE_TTL_MS = 5 * MINUTE;

export const WHATSAPP_UNDELIVERABLE = 131026;

export const WHATSAPP_SIGNATURE_HEADER = "x-hub-signature-256";

export const TWILIO_API = "https://api.twilio.com/2010-04-01";

export const TWILIO_UNDELIVERABLE: readonly number[] = [63003, 63024];

export const TWILIO_SIGNATURE_HEADER = "x-twilio-signature";

export const OUTBOUND_DOCUMENT_CATEGORY = "outbound";
