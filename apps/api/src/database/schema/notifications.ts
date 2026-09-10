import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATES,
} from '@clinic/shared';
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { appointments } from '@api/database/schema/appointments';
import { clinics } from '@api/database/schema/core';
import { patients } from '@api/database/schema/patients';

export const notificationChannelEnum = pgEnum('notification_channel', NOTIFICATION_CHANNELS);
export const notificationTemplateEnum = pgEnum('notification_template', NOTIFICATION_TEMPLATES);
export const notificationStatusEnum = pgEnum('notification_status', NOTIFICATION_STATUSES);

// Written before the provider is called, so a send that throws still leaves a trace. It is also the
// reminder dedupe key — a second table holding that fact could disagree with this one.
export const notificationsLog = pgTable(
  'notifications_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    /** Destination, as dialled. Not joined to a patient: a message can go to
     *  a number that has no record yet, which is exactly the booking case. */
    to: text('to').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    template: notificationTemplateEnum('template').notNull(),
    /** The interpolation values, so a sent message can be reconstructed. */
    vars: jsonb('vars').$type<Record<string, string>>().notNull().default({}),
    status: notificationStatusEnum('status').notNull().default('queued'),
    error: text('error'),
    appointmentId: uuid('appointment_id').references(() => appointments.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_log_clinic_created_idx').on(table.clinicId, table.createdAt),
    index('notifications_log_appointment_idx').on(table.appointmentId, table.template),
  ],
);

// The code is hashed: anyone with database access could otherwise confirm bookings they did not
// make. Hard-deleted once spent — operational data, not a medical record.
export const bookingOtps = pgTable(
  'booking_otps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Wrong guesses so far. Three is the limit; the row is then dead. */
    attempts: integer('attempts').notNull().default(0),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('booking_otps_appointment_idx').on(table.appointmentId)],
);
