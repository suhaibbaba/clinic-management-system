import { boolean, date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { clinics, doctors } from '@api/database/schema/core';

/* -------------------------------------------------------------------------- */
/* Shared column groups                                                        */
/* -------------------------------------------------------------------------- */

const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

const softDeleteColumn = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

/* -------------------------------------------------------------------------- */
/* Tables                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Days the clinic is shut, whatever the weekly opening hours say.
 *
 * Whole days only — `date`, not `timestamptz`. A closure is a fact about the
 * calendar rather than about a moment, so it needs no timezone: the clinic is
 * shut on the 20th, and which instant that starts at is the availability
 * service's business, resolved against the clinic's own zone at read time.
 * Storing instants here would have made the same row mean different days for a
 * server in UTC and a clinic in Damascus.
 *
 * This replaces the `settings.holidays` array of dates, which could hold no
 * reason, could not be audited, and had no id for a cancelled appointment to
 * point back at.
 */
export const clinicClosures = pgTable(
  'clinic_closures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    /** Inclusive. A single-day closure repeats the date in both columns. */
    startsOn: date('starts_on').notNull(),
    /** Inclusive — the last day the clinic is shut, not the day it reopens. */
    endsOn: date('ends_on').notNull(),
    reason: text('reason').notNull(),
    /** Repeats on the same day and month every year (see the shared schema). */
    isAnnual: boolean('is_annual').notNull().default(false),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('clinic_closures_clinic_idx').on(table.clinicId),
    // Availability asks for the closures covering one day, so the range end is
    // the leading column of the predicate that narrows most.
    index('clinic_closures_range_idx').on(table.clinicId, table.endsOn, table.startsOn),
  ],
);

/**
 * One doctor's absence — a whole day, several days, or part of an afternoon.
 *
 * `timestamptz` rather than dates, because half of these are partial: 14:00 to
 * 18:00 at a conference is the case the clinic's old "off day" toggle could
 * not express at all, and it is the common one. A whole day is the same shape
 * with local midnight at each end, so nothing downstream has to branch on
 * which kind a row is.
 *
 * Half-open `[starts_at, ends_at)`, matching an appointment's own block, so
 * "does this absence collide with that appointment?" is the same comparison
 * the calendar already makes everywhere else.
 */
export const doctorTimeOff = pgTable(
  'doctor_time_off',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    reason: text('reason').notNull(),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('doctor_time_off_clinic_idx').on(table.clinicId),
    // Every read is "this doctor, around this day", which is exactly this.
    index('doctor_time_off_doctor_starts_idx').on(table.doctorId, table.startsAt),
  ],
);
