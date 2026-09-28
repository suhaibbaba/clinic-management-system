import type { TimeRange } from "@clinic/shared";
import { boolean, date, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinics, doctors } from "@api/database/schema/core";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

const softDeleteColumn = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const clinicClosures = pgTable(
  "clinic_closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    reason: text("reason").notNull(),
    isAnnual: boolean("is_annual").notNull().default(false),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("clinic_closures_clinic_idx").on(table.clinicId),
    index("clinic_closures_range_idx").on(table.clinicId, table.endsOn, table.startsOn),
  ],
);

export const doctorTimeOff = pgTable(
  "doctor_time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("doctor_time_off_clinic_idx").on(table.clinicId),
    index("doctor_time_off_doctor_starts_idx").on(table.doctorId, table.startsAt),
  ],
);

export const doctorExtraHours = pgTable(
  "doctor_extra_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    date: date("date", { mode: "string" }).notNull(),
    ranges: jsonb("ranges").$type<TimeRange[]>().notNull(),
    reason: text("reason").notNull(),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("doctor_extra_hours_clinic_idx").on(table.clinicId),
    index("doctor_extra_hours_doctor_date_idx").on(table.doctorId, table.date),
  ],
);
