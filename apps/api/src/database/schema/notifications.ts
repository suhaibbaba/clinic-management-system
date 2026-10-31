import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATES,
  WHATSAPP_STATUS_SOURCES,
  WHATSAPP_STATUSES,
} from "@clinic/shared";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { appointments } from "@api/database/schema/appointments";
import { clinics } from "@api/database/schema/core";
import { patients } from "@api/database/schema/patients";

export const notificationChannelEnum = pgEnum("notification_channel", NOTIFICATION_CHANNELS);
export const notificationTemplateEnum = pgEnum("notification_template", NOTIFICATION_TEMPLATES);
export const notificationStatusEnum = pgEnum("notification_status", NOTIFICATION_STATUSES);

export const notificationsLog = pgTable(
  "notifications_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    to: text("to").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    template: notificationTemplateEnum("template").notNull(),
    vars: jsonb("vars").$type<Record<string, string>>().notNull().default({}),
    status: notificationStatusEnum("status").notNull().default("queued"),
    error: text("error"),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_log_clinic_created_idx").on(table.clinicId, table.createdAt),
    index("notifications_log_appointment_idx").on(table.appointmentId, table.template),
  ],
);

export const bookingOtps = pgTable(
  "booking_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("booking_otps_appointment_idx").on(table.appointmentId)],
);

export const whatsAppStatusEnum = pgEnum("whatsapp_status", WHATSAPP_STATUSES);
export const whatsAppStatusSourceEnum = pgEnum("whatsapp_status_source", WHATSAPP_STATUS_SOURCES);

export const whatsAppChecks = pgTable(
  "whatsapp_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    phone: text("phone").notNull(),
    status: whatsAppStatusEnum("status").notNull().default("unknown"),
    source: whatsAppStatusSourceEnum("source").notNull().default("otp"),
    providerMessageId: text("provider_message_id"),
    codeHash: text("code_hash"),
    codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("whatsapp_checks_clinic_phone_uniq").on(table.clinicId, table.phone),
    uniqueIndex("whatsapp_checks_message_uniq").on(table.providerMessageId),
  ],
);
