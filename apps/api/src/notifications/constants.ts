import type { Reminder } from "@api/notifications/lib/reminders.scheduler";
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
