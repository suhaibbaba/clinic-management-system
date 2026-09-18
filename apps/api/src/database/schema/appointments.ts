import {
  APPOINTMENT_STATUSES,
  WAITING_LIST_PRIORITIES,
  WAITING_LIST_SOURCES,
  WAITING_LIST_STATUSES,
} from "@clinic/shared";
import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinics, doctors } from "@api/database/schema/core";
import { patients, visits } from "@api/database/schema/patients";

export const appointmentStatusEnum = pgEnum("appointment_status", APPOINTMENT_STATUSES);
export const waitingListPriorityEnum = pgEnum("waiting_list_priority", WAITING_LIST_PRIORITIES);
export const waitingListSourceEnum = pgEnum("waiting_list_source", WAITING_LIST_SOURCES);
export const waitingListStatusEnum = pgEnum("waiting_list_status", WAITING_LIST_STATUSES);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

const softDeleteColumn = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

// The end is not a column — `starts_at` plus `duration_minutes`. Overlap is prevented by the `gist`
// exclusion constraint, the only thing that holds under concurrency.
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    // An `appointment_type` lookup code, not an enum — a clinic adds one without a migration. The
    // status beside it stays an enum: it drives the transition table.
    type: text("type").notNull().default("checkup"),
    status: appointmentStatusEnum("status").notNull().default("confirmed"),
    reason: text("reason"),
    notes: text("notes"),
    visitId: uuid("visit_id").references(() => visits.id),
    /** Required when the status becomes `cancelled`, enforced in the service. */
    cancelledReason: text("cancelled_reason"),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("appointments_clinic_idx").on(table.clinicId),
    index("appointments_doctor_starts_idx").on(table.clinicId, table.doctorId, table.startsAt),
    index("appointments_starts_idx").on(table.clinicId, table.startsAt),
    index("appointments_patient_idx").on(table.clinicId, table.patientId),
  ],
);

export const waitingList = pgTable(
  "waiting_list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    /** Null when any doctor will do, which is most walk-ins. */
    doctorId: uuid("doctor_id").references(() => doctors.id),
    /** The complaint. One field, whether reception typed it or the patient did. */
    reason: text("reason"),
    priority: waitingListPriorityEnum("priority").notNull().default("normal"),
    source: waitingListSourceEnum("source").notNull().default("reception"),
    // A state machine rather than an editable list, so `resolved_at` is the consequence of reaching
    // a terminal status rather than a second, separate truth.
    status: waitingListStatusEnum("status").notNull().default("pending"),
    declinedReason: text("declined_reason"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("waiting_list_clinic_idx").on(table.clinicId),
    /** The panel reads the open queue; resolved rows are history. */
    index("waiting_list_open_idx")
      .on(table.clinicId, table.priority, table.createdAt)
      .where(sql`resolved_at is null and deleted_at is null`),
    /** The badge counts what arrived online and nobody has answered. */
    index("waiting_list_source_status_idx").on(table.clinicId, table.source, table.status),
  ],
);
