import { sql } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clinics, users } from "@api/database/schema/core";
import { patients, performedProcedures } from "@api/database/schema/patients";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

const softDeleteColumn = { deletedAt: timestamp("deleted_at", { withTimezone: true }) };

const currentEntries = sql`deleted_at is null and reverses_id is null and reversed_at is null`;

const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

export const charges = pgTable(
  "charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    performedProcedureId: uuid("performed_procedure_id").references(() => performedProcedures.id),
    amount: money("amount").notNull(),
    discount: money("discount").notNull().default("0.00"),
    discountReason: text("discount_reason"),
    note: text("note"),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("charges_clinic_idx").on(table.clinicId),
    index("charges_patient_idx").on(table.clinicId, table.patientId, table.createdAt),
    uniqueIndex("charges_procedure_uniq").on(table.performedProcedureId).where(currentEntries),
    index("charges_reverses_idx").on(table.reversesId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    amount: money("amount").notNull(),
    method: text("method").notNull(),
    note: text("note"),
    receiptNumber: integer("receipt_number"),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    receivedBy: uuid("received_by").references(() => users.id),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("payments_clinic_idx").on(table.clinicId),
    index("payments_patient_idx").on(table.clinicId, table.patientId, table.createdAt),
    uniqueIndex("payments_receipt_uniq").on(table.clinicId, table.receiptNumber),
    index("payments_reverses_idx").on(table.reversesId),
  ],
);

export const clinicCounters = pgTable("clinic_counters", {
  clinicId: uuid("clinic_id")
    .primaryKey()
    .references(() => clinics.id),
  nextReceiptNumber: integer("next_receipt_number").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
