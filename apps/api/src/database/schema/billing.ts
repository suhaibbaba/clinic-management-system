import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { clinics, users } from '@api/database/schema/core';
import { patients, performedProcedures } from '@api/database/schema/patients';

const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

const softDeleteColumn = { deletedAt: timestamp('deleted_at', { withTimezone: true }) };

// Still the current entry for its subject: live, not itself a reversing entry, and not yet
// cancelled by one.
const currentEntries = sql`deleted_at is null and reverses_id is null and reversed_at is null`;

// `numeric(10,2)`, read and written as a string — never a float. Signed: a reversing entry carries
// the negative of what it cancels.
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

// Append-only. A wrong amount is cancelled by inserting its negative with `reverses_id` pointing
// back, and the corrected amount is a new row.
export const charges = pgTable(
  'charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    // At most one charge per procedure is in force, enforced by `charges_procedure_uniq`. An
    // amended procedure keeps all three rows. Null for a hand-raised charge.
    performedProcedureId: uuid('performed_procedure_id').references(() => performedProcedures.id),
    amount: money('amount').notNull(),
    discount: money('discount').notNull().default('0.00'),
    discountReason: text('discount_reason'),
    note: text('note'),
    reversesId: uuid('reverses_id'),
    // Set on the original when its reversal is written. Bookkeeping, not money — no amount on this
    // row moves.
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('charges_clinic_idx').on(table.clinicId),
    index('charges_patient_idx').on(table.clinicId, table.patientId, table.createdAt),
    uniqueIndex('charges_procedure_uniq').on(table.performedProcedureId).where(currentEntries),
    index('charges_reverses_idx').on(table.reversesId),
  ],
);

// `receipt_number` comes from `clinic_counters` in the same transaction, so the sequence is
// gapless: a Postgres sequence would not roll back with it.
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    amount: money('amount').notNull(),
    /** A `payment_method` lookup code — a clinic may add "شيك". */
    method: text('method').notNull(),
    note: text('note'),
    /** Null on a reversal: it is documented by the receipt it cancels. */
    receiptNumber: integer('receipt_number'),
    reversesId: uuid('reverses_id'),
    /** Back-pointer, set on the original when its reversal is written. */
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    /** The user who took the money, kept apart from `created_by`. */
    receivedBy: uuid('received_by').references(() => users.id),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('payments_clinic_idx').on(table.clinicId),
    index('payments_patient_idx').on(table.clinicId, table.patientId, table.createdAt),
    uniqueIndex('payments_receipt_uniq').on(table.clinicId, table.receiptNumber),
    index('payments_reverses_idx').on(table.reversesId),
  ],
);

// Bumped with `UPDATE ... RETURNING` inside the payment's transaction: the row lock serialises
// concurrent payments and a rollback gives the number back.
export const clinicCounters = pgTable('clinic_counters', {
  clinicId: uuid('clinic_id')
    .primaryKey()
    .references(() => clinics.id),
  nextReceiptNumber: integer('next_receipt_number').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
