import { LAB_ORDER_STATUSES } from '@clinic/shared';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { clinics, doctors, users } from '@api/database/schema/core';
import { patients, performedProcedures } from '@api/database/schema/patients';

export const labOrderStatusEnum = pgEnum('lab_order_status', LAB_ORDER_STATUSES);

const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

const softDeleteColumn = { deletedAt: timestamp('deleted_at', { withTimezone: true }) };

/** Money is `numeric(10, 2)`, read and written as a string — never a float. */
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

/* -------------------------------------------------------------------------- */
/* The labs themselves                                                         */
/* -------------------------------------------------------------------------- */

/**
 * An outside workshop the clinic sends work to.
 *
 * Soft-deleted rather than removed: a lab the clinic stopped using still has
 * orders and payments in its history, and a directory that loses a name makes
 * a statement unreadable. `is_active` is the everyday switch — it keeps a lab
 * out of the pickers while leaving its record intact.
 */
export const labs = pgTable(
  'labs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    name: text('name').notNull(),
    phone: text('phone'),
    address: text('address'),
    /** Who to ask for when the clinic rings. */
    contactPerson: text('contact_person'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [index('labs_clinic_idx').on(table.clinicId, table.name)],
);

/**
 * One line of a lab's price list.
 *
 * Per lab, not global: two labs charge differently for the same crown. The
 * price here is what an order *starts* from — the order keeps its own copy, so
 * a price rise never rewrites work already ordered.
 */
export const labWorkTypes = pgTable(
  'lab_work_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    labId: uuid('lab_id')
      .notNull()
      .references(() => labs.id),
    nameAr: text('name_ar').notNull(),
    defaultPrice: money('default_price').notNull().default('0.00'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [index('lab_work_types_lab_idx').on(table.labId, table.nameAr)],
);

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A piece of work ordered from a lab for one patient.
 *
 * The four timestamps are written by the **transitions**, never by a form:
 * `sent_at` when it goes out, `received_at` when it comes back, `fitted_at`
 * when it goes in the patient's mouth. `expected_at` is the one date a person
 * types, because it is a promise rather than a record. A dated field that a
 * form can set independently of the status is a field that will eventually
 * disagree with it.
 *
 * `price` is a snapshot of the work type's price at the moment of ordering —
 * the same reasoning as a charge's amount. What the clinic owes cannot move
 * because the lab published a new list.
 *
 * `teeth` is a JSONB array of FDI numbers rather than a join table: a bridge's
 * teeth are read and written as one value, never queried across, and a table
 * with four rows per order would be four rows nobody ever selects separately.
 */
export const labOrders = pgTable(
  'lab_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    labId: uuid('lab_id')
      .notNull()
      .references(() => labs.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id),
    /** The treatment that needs it, when the order was raised from one. */
    performedProcedureId: uuid('performed_procedure_id').references(() => performedProcedures.id),
    workTypeId: uuid('work_type_id').references(() => labWorkTypes.id),
    material: text('material'),
    shade: text('shade'),
    teeth: jsonb('teeth').$type<number[]>().notNull().default([]),
    instructions: text('instructions'),
    price: money('price').notNull().default('0.00'),
    status: labOrderStatusEnum('status').notNull().default('draft'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    /** The date the lab promised. Typed, not derived. */
    expectedAt: timestamp('expected_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    fittedAt: timestamp('fitted_at', { withTimezone: true }),
    /** Required when the status becomes `returned`, enforced in the service. */
    returnReason: text('return_reason'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('lab_orders_clinic_idx').on(table.clinicId, table.status),
    index('lab_orders_lab_idx').on(table.clinicId, table.labId),
    index('lab_orders_patient_idx').on(table.clinicId, table.patientId),
    /** The overdue query: what is still out, ordered by the date it was due. */
    index('lab_orders_expected_idx').on(table.clinicId, table.expectedAt),
    index('lab_orders_procedure_idx').on(table.performedProcedureId),
  ],
);

/**
 * A file that travels with an order: a shade photo, an intra-oral scan.
 *
 * Same flow as an X-ray — the bytes go straight to R2 through a presigned URL
 * and never through the API — so this table holds a key and its metadata and
 * nothing else. No `clinic_id` of its own: an attachment belongs to exactly
 * one order, and the order carries the scope.
 */
export const labOrderAttachments = pgTable(
  'lab_order_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    labOrderId: uuid('lab_order_id')
      .notNull()
      .references(() => labOrders.id),
    r2Key: text('r2_key').notNull(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('lab_order_attachments_order_idx').on(table.labOrderId),
    uniqueIndex('lab_order_attachments_key_uniq').on(table.r2Key),
  ],
);

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What the clinic has paid a lab.
 *
 * Append-only, exactly like `payments` (CLAUDE.md architecture decision 2):
 * nothing here is ever edited, and a mistaken payment is cancelled by writing
 * the negative of it with `reverses_id` pointing back. The lab's balance is
 * `sum(billable orders) − sum(payments)`, computed on read — there is no
 * stored balance column anywhere in this file, and there must never be one.
 *
 * No receipt number: a receipt is a document the clinic *hands out*, and this
 * is money going the other way. The lab issues its own.
 */
export const labPayments = pgTable(
  'lab_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    labId: uuid('lab_id')
      .notNull()
      .references(() => labs.id),
    /** Signed: a reversing entry carries the negative of what it cancels. */
    amount: money('amount').notNull(),
    /** The same `payment_method` lookup list the patient ledger reads. */
    method: text('method').notNull(),
    note: text('note'),
    reversesId: uuid('reverses_id'),
    /** Back-pointer, set on the original when its reversal is written. */
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    /** The user who handed the money over, kept apart from `created_by`. */
    paidBy: uuid('paid_by').references(() => users.id),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('lab_payments_clinic_idx').on(table.clinicId),
    index('lab_payments_lab_idx').on(table.clinicId, table.labId, table.createdAt),
    index('lab_payments_reverses_idx').on(table.reversesId),
  ],
);
