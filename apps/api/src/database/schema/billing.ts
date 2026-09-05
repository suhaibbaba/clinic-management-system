import { PAYMENT_METHODS } from '@clinic/shared';
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { clinics, users } from '@api/database/schema/core';
import { patients, performedProcedures } from '@api/database/schema/patients';

export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);

const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

const softDeleteColumn = { deletedAt: timestamp('deleted_at', { withTimezone: true }) };

/**
 * A ledger row that still counts as the current entry for its subject: live,
 * not itself a reversing entry, and not yet cancelled by one.
 */
const currentEntries = sql`deleted_at is null and reverses_id is null and reversed_at is null`;

/**
 * Money is `numeric(10, 2)`, read and written as a string — never a float.
 * Signed: a reversing entry carries the negative of what it cancels.
 */
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

/**
 * What a patient owes, one row per reason.
 *
 * Append-only (CLAUDE.md architecture decision 2). Nothing here is ever
 * updated: an amount that turns out to be wrong is cancelled by inserting the
 * negative of it with `reverses_id` pointing back, and the corrected amount is
 * inserted as a new row. That is the only way the number changes, which is what
 * makes the ledger auditable.
 */
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
    /**
     * The work that caused the charge. At most one charge per procedure is ever
     * *in force* — the database enforces it (`charges_procedure_uniq`), not the
     * service. An amended procedure still keeps its whole history: the original,
     * its reversal and the corrected charge all carry the same procedure id, but
     * only the last of them is neither a reversal nor reversed. Null for a
     * charge raised by hand.
     */
    performedProcedureId: uuid('performed_procedure_id').references(() => performedProcedures.id),
    amount: money('amount').notNull(),
    discount: money('discount').notNull().default('0.00'),
    discountReason: text('discount_reason'),
    note: text('note'),
    /** Set on a reversing entry: the charge this one cancels. */
    reversesId: uuid('reverses_id'),
    /**
     * Back-pointer, set on the original when its reversal is written. It is
     * bookkeeping, not money — every amount on this row stays untouched — and
     * it is what lets the database enforce "one charge in force per procedure"
     * while an amended procedure keeps all three rows of its history.
     */
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

/**
 * Money taken in. Append-only for the same reason as charges.
 *
 * `receipt_number` is allocated per clinic from `clinic_counters` inside the
 * same transaction as the insert, so the sequence has no gaps even under
 * concurrent payments — a Postgres sequence would not do, because a sequence
 * does not roll back with its transaction.
 */
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
    method: paymentMethodEnum('method').notNull(),
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

/**
 * Per-clinic counters for numbers that must be gapless.
 *
 * One row per clinic, bumped with `UPDATE ... RETURNING` inside the payment's
 * own transaction. That takes a row lock, so concurrent payments serialise on
 * it and a rolled-back payment gives its number back.
 */
export const clinicCounters = pgTable('clinic_counters', {
  clinicId: uuid('clinic_id')
    .primaryKey()
    .references(() => clinics.id),
  nextReceiptNumber: integer('next_receipt_number').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
