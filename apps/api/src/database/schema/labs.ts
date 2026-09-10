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

// Soft-deleted: a lab the clinic stopped using still has orders and payments, and a statement that
// loses its name is unreadable.
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
    contactPerson: text('contact_person'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [index('labs_clinic_idx').on(table.clinicId, table.name)],
);

// Per lab, not global. The order keeps its own copy of the price, so a rise never rewrites work
// already ordered.
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

// The timestamps are written by the transitions, never a form — only `expected_at` is typed, being
// a promise. `teeth` is JSONB because a bridge's teeth are read as one value, never queried across.
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
    index('lab_orders_expected_idx').on(table.clinicId, table.expectedAt),
    index('lab_orders_procedure_idx').on(table.performedProcedureId),
  ],
);

// Bytes go straight to R2, so this holds a key and metadata. No `clinic_id`: an attachment belongs
// to one order, which carries the scope.
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

// Append-only; the lab's balance is computed on read and never stored. No receipt number — a
// receipt is a document the clinic hands out, and this is money going the other way.
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
