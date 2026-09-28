import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATES,
} from "@clinic/shared";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("booking_otps_appointment_idx").on(table.appointmentId)],
);
