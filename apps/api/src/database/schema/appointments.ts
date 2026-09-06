import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES, WAITING_LIST_PRIORITIES } from '@clinic/shared';
import { sql } from 'drizzle-orm';
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { clinics, doctors } from '@api/database/schema/core';
import { patients, visits } from '@api/database/schema/patients';

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const appointmentTypeEnum = pgEnum('appointment_type', APPOINTMENT_TYPES);
export const appointmentStatusEnum = pgEnum('appointment_status', APPOINTMENT_STATUSES);
export const waitingListPriorityEnum = pgEnum('waiting_list_priority', WAITING_LIST_PRIORITIES);

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
 * A booked slot in a doctor's day.
 *
 * The end of an appointment is **not** a column: it is `starts_at` plus
 * `duration_minutes`, computed wherever it is needed and by the overlap
 * constraint below. Storing both is storing the same fact twice, and the two
 * would eventually disagree after one rescheduling bug.
 *
 * Two overlapping appointments for one doctor are prevented by a `gist`
 * exclusion constraint added in the migration — see `0004_appointments_module`.
 * Drizzle cannot express `EXCLUDE`, and a check in the service could not do the
 * job anyway: between reading "the slot is free" and inserting, another request
 * can insert the same slot. The constraint is the only place that holds under
 * concurrency, which is why it is the constraint and not the service that
 * rejects the second booking.
 */
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    type: appointmentTypeEnum('type').notNull().default('checkup'),
    status: appointmentStatusEnum('status').notNull().default('confirmed'),
    reason: text('reason'),
    notes: text('notes'),
    /** Set by "convert to visit"; the link that joins the two records. */
    visitId: uuid('visit_id').references(() => visits.id),
    /** Required when the status becomes `cancelled`, enforced in the service. */
    cancelledReason: text('cancelled_reason'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('appointments_clinic_idx').on(table.clinicId),
    /**
     * The calendar's own index: every feed asks for one doctor over a date
     * range, and the day view asks for all of them over one day. Leading with
     * the clinic keeps it useful for the second question too.
     */
    index('appointments_doctor_starts_idx').on(table.clinicId, table.doctorId, table.startsAt),
    index('appointments_starts_idx').on(table.clinicId, table.startsAt),
    index('appointments_patient_idx').on(table.clinicId, table.patientId),
  ],
);

/**
 * Walk-ins and callers waiting for a slot that does not exist yet.
 *
 * Not an appointment with a null time: an appointment has a place in a day and
 * this does not, and modelling "no time yet" as a nullable `starts_at` would
 * put a null into every calendar query and every overlap check.
 *
 * `resolved_at` closes the entry — promoted into an appointment, or the patient
 * gave up. Soft-deleted like everything else, so a queue is auditable.
 */
export const waitingList = pgTable(
  'waiting_list',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    /** Null when any doctor will do, which is most walk-ins. */
    doctorId: uuid('doctor_id').references(() => doctors.id),
    reason: text('reason'),
    priority: waitingListPriorityEnum('priority').notNull().default('normal'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** The appointment this entry became, when it was promoted. */
    appointmentId: uuid('appointment_id').references(() => appointments.id),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('waiting_list_clinic_idx').on(table.clinicId),
    /** The panel reads the open queue; resolved rows are history. */
    index('waiting_list_open_idx')
      .on(table.clinicId, table.priority, table.createdAt)
      .where(sql`resolved_at is null and deleted_at is null`),
  ],
);
