import { z } from 'zod';

import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATE,
  NOTIFICATION_TEMPLATES,
  type NotificationTemplate,
} from '@shared/enums';
import { paginationQuerySchema, uuidSchema } from '@shared/schemas/common';

/** Append-only like the ledgers: a failed message is a row saying so, never an absence. */
export const notificationLogEntrySchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  to: z.string(),
  channel: z.enum(NOTIFICATION_CHANNELS),
  template: z.enum(NOTIFICATION_TEMPLATES),
  vars: z.record(z.string(), z.string()),
  status: z.enum(NOTIFICATION_STATUSES),
  error: z.string().nullable(),
  /** The appointment it is about, when it is about one. Drives reminder dedupe. */
  appointmentId: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type NotificationLogEntry = z.infer<typeof notificationLogEntrySchema>;

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  template: z.enum(NOTIFICATION_TEMPLATES).optional(),
  appointmentId: uuidSchema.optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const notificationSettingsSchema = z.object({
  /** Master switch. Off means the whole module is inert, scheduler included. */
  enabled: z.boolean().default(true),
  channel: z.enum(NOTIFICATION_CHANNELS).default(NOTIFICATION_CHANNEL.SMS),
  /** Per-reminder toggles: a clinic may want the day before but not the hour. */
  remind24h: z.boolean().default(true),
  remind2h: z.boolean().default(true),
  templates: z.record(z.string(), z.string()).default({}),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

/** Arabic: the UI's English mode is for staff, and an SMS is not the UI. */
export const DEFAULT_NOTIFICATION_TEMPLATES: Record<NotificationTemplate, string> = {
  [NOTIFICATION_TEMPLATE.BOOKING_OTP]:
    'رمز تأكيد حجزك في {clinic} هو {code}. صالح لمدة {minutes} دقائق.',
  [NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED]:
    'تم تأكيد موعدك في {clinic} مع {doctor} يوم {date} الساعة {time}. لإدارة الموعد: {link}',
  [NOTIFICATION_TEMPLATE.REMINDER_24H]:
    'تذكير: لديك موعد غداً في {clinic} مع {doctor} الساعة {time}.',
  [NOTIFICATION_TEMPLATE.REMINDER_2H]:
    'تذكير: موعدك في {clinic} مع {doctor} بعد ساعتين، الساعة {time}.',
  [NOTIFICATION_TEMPLATE.BOOKING_CANCELLED]:
    'تم إلغاء موعدك في {clinic} يوم {date} الساعة {time}. للحجز من جديد تواصل معنا.',
};

/** Never throws: unreadable settings must not stop a reminder from going out. */
export function notificationSettings(settings: unknown): NotificationSettings {
  const raw =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)['notifications']
      : undefined;

  const parsed = notificationSettingsSchema.safeParse(raw ?? {});

  return parsed.success
    ? parsed.data
    : {
        enabled: true,
        channel: NOTIFICATION_CHANNEL.SMS,
        remind24h: true,
        remind2h: true,
        templates: {},
      };
}

// An unknown placeholder is left standing — "الساعة {time}" is a visible bug, where "الساعة " looks
// fine and says nothing.
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replaceAll(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}
