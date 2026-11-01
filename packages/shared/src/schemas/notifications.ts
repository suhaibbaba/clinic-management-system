import { z } from "zod";
import type { LanguageCode } from "@shared/locale/languages";
import { localized, type LocalizedText } from "@shared/locale/localized-text";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATE,
  NOTIFICATION_TEMPLATES,
  type NotificationTemplate,
} from "@shared/enums";
import { paginationQuerySchema, phoneSchema, uuidSchema } from "@shared/schemas/common";

export const notificationLogEntrySchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  to: z.string(),
  channel: z.enum(NOTIFICATION_CHANNELS),
  template: z.enum(NOTIFICATION_TEMPLATES),
  vars: z.record(z.string(), z.string()),
  status: z.enum(NOTIFICATION_STATUSES),
  error: z.string().nullable(),
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
  enabled: z.boolean().default(true),
  channel: z.enum(NOTIFICATION_CHANNELS).default(NOTIFICATION_CHANNEL.SMS),
  remind24h: z.boolean().default(true),
  remind2h: z.boolean().default(true),
  templates: z.record(z.string(), z.string()).default({}),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

const ARABIC_TEMPLATES: Record<NotificationTemplate, string> = {
  [NOTIFICATION_TEMPLATE.BOOKING_OTP]:
    "رمز تأكيد حجزك في {clinic} هو {code}. صالح لمدة {minutes} دقائق.",
  [NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED]:
    "تم تأكيد موعدك في {clinic} مع {doctor} يوم {date} الساعة {time}. لإدارة الموعد: {link}",
  [NOTIFICATION_TEMPLATE.REMINDER_24H]:
    "تذكير: لديك موعد غداً في {clinic} مع {doctor} الساعة {time}.",
  [NOTIFICATION_TEMPLATE.REMINDER_2H]:
    "تذكير: موعدك في {clinic} مع {doctor} بعد ساعتين، الساعة {time}.",
  [NOTIFICATION_TEMPLATE.BOOKING_CANCELLED]:
    "تم إلغاء موعدك في {clinic} يوم {date} الساعة {time}. للحجز من جديد تواصل معنا.",
  [NOTIFICATION_TEMPLATE.URGENT_RECEIVED]:
    "وصلنا طلبك العاجل في {clinic}. سنتواصل معك بأقرب وقت على هذا الرقم.",
  [NOTIFICATION_TEMPLATE.URGENT_SCHEDULED]:
    "حجزنا لك موعداً في {clinic} مع {doctor} يوم {date} الساعة {time}.",
  [NOTIFICATION_TEMPLATE.URGENT_DECLINED]:
    "بخصوص طلبك العاجل في {clinic}: {reason}. للاستفسار تواصل معنا.",
  [NOTIFICATION_TEMPLATE.ASSISTANT_MESSAGE]: "{body}",
  [NOTIFICATION_TEMPLATE.DOCUMENT]: "{document} من {clinic}.",
  [NOTIFICATION_TEMPLATE.PORTAL_CODE]:
    "رمز الدخول إلى حسابك في {clinic} هو {code}. صالح لمدة {minutes} دقائق. لا تشاركه مع أحد.",
};

const ENGLISH_TEMPLATES: Record<NotificationTemplate, string> = {
  [NOTIFICATION_TEMPLATE.BOOKING_OTP]:
    "Your booking code for {clinic} is {code}. It is valid for {minutes} minutes.",
  [NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED]:
    "Your appointment at {clinic} with {doctor} is confirmed for {date} at {time}. Manage it here: {link}",
  [NOTIFICATION_TEMPLATE.REMINDER_24H]:
    "Reminder: you have an appointment tomorrow at {clinic} with {doctor} at {time}.",
  [NOTIFICATION_TEMPLATE.REMINDER_2H]:
    "Reminder: your appointment at {clinic} with {doctor} is in two hours, at {time}.",
  [NOTIFICATION_TEMPLATE.BOOKING_CANCELLED]:
    "Your appointment at {clinic} on {date} at {time} has been cancelled. Contact us to book again.",
  [NOTIFICATION_TEMPLATE.URGENT_RECEIVED]:
    "We have received your urgent request at {clinic}. We will call you on this number as soon as we can.",
  [NOTIFICATION_TEMPLATE.URGENT_SCHEDULED]:
    "We have booked you an appointment at {clinic} with {doctor} on {date} at {time}.",
  [NOTIFICATION_TEMPLATE.URGENT_DECLINED]:
    "About your urgent request at {clinic}: {reason}. Contact us with any questions.",
  [NOTIFICATION_TEMPLATE.ASSISTANT_MESSAGE]: "{body}",
  [NOTIFICATION_TEMPLATE.DOCUMENT]: "{document} from {clinic}.",
  [NOTIFICATION_TEMPLATE.PORTAL_CODE]:
    "Your sign-in code for {clinic} is {code}. It is valid for {minutes} minutes. Do not share it with anyone.",
};

const TURKISH_TEMPLATES: Record<NotificationTemplate, string> = {
  [NOTIFICATION_TEMPLATE.BOOKING_OTP]:
    "{clinic} randevu onay kodunuz: {code}. Kod {minutes} dakika geçerlidir.",
  [NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED]:
    "{clinic} randevunuz onaylandı. Doktor: {doctor}, tarih: {date}, saat: {time}. Randevunuzu yönetmek için: {link}",
  [NOTIFICATION_TEMPLATE.REMINDER_24H]:
    "Hatırlatma: Yarın saat {time} için {clinic} kliniğinde {doctor} ile randevunuz var.",
  [NOTIFICATION_TEMPLATE.REMINDER_2H]:
    "Hatırlatma: {clinic} kliniğinde {doctor} ile randevunuz iki saat sonra, saat {time}.",
  [NOTIFICATION_TEMPLATE.BOOKING_CANCELLED]:
    "{clinic} kliniğindeki {date} tarihli, saat {time} randevunuz iptal edildi. Yeni randevu için bize ulaşın.",
  [NOTIFICATION_TEMPLATE.URGENT_RECEIVED]:
    "{clinic} kliniğine acil talebiniz ulaştı. En kısa sürede bu numaradan size dönüş yapacağız.",
  [NOTIFICATION_TEMPLATE.URGENT_SCHEDULED]:
    "{clinic} kliniğinde {doctor} ile {date} tarihinde saat {time} için randevunuz oluşturuldu.",
  [NOTIFICATION_TEMPLATE.URGENT_DECLINED]:
    "{clinic} kliniğine acil talebiniz hakkında: {reason}. Sorularınız için bize ulaşın.",
  [NOTIFICATION_TEMPLATE.ASSISTANT_MESSAGE]: "{body}",
  [NOTIFICATION_TEMPLATE.DOCUMENT]: "{clinic}: {document}.",
  [NOTIFICATION_TEMPLATE.PORTAL_CODE]:
    "{clinic} hesabınıza giriş kodunuz: {code}. Kod {minutes} dakika geçerlidir. Kimseyle paylaşmayın.",
};

export const DEFAULT_NOTIFICATION_TEMPLATES: Record<
  LanguageCode,
  Record<NotificationTemplate, string>
> = {
  ar: ARABIC_TEMPLATES,
  en: ENGLISH_TEMPLATES,
  tr: TURKISH_TEMPLATES,
};

export const defaultNotificationTemplate = (
  template: NotificationTemplate,
  language: LanguageCode,
): string => DEFAULT_NOTIFICATION_TEMPLATES[language][template];

export type NotificationVars = Readonly<Record<string, string | LocalizedText>>;

export const resolveNotificationVars = (
  vars: NotificationVars,
  language: LanguageCode,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [
      key,
      typeof value === "string" ? value : localized(value, language),
    ]),
  );

export function notificationSettings(settings: unknown): NotificationSettings {
  const raw =
    typeof settings === "object" && settings !== null
      ? (settings as Record<string, unknown>)["notifications"]
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

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replaceAll(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

export const sendDocumentSchema = z.object({
  to: phoneSchema,
});

export type SendDocumentInput = z.infer<typeof sendDocumentSchema>;

export const documentDeliverySchema = z.object({
  available: z.boolean(),
});

export type DocumentDelivery = z.infer<typeof documentDeliverySchema>;
