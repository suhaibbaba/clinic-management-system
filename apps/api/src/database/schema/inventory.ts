import { MOVEMENT_TYPES } from '@clinic/shared';
import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { clinics } from '@api/database/schema/core';
import { patients, performedProcedures } from '@api/database/schema/patients';

export const movementTypeEnum = pgEnum('movement_type', MOVEMENT_TYPES);

const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

const softDeleteColumn = { deletedAt: timestamp('deleted_at', { withTimezone: true }) };

/** Money is `numeric(10, 2)`, read and written as a string — never a float. */
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

/**
 * A stock quantity: `numeric(12, 3)`, also a string in TypeScript.
 *
 * Three decimals because half the units are continuous — 2.5 ml of anaesthetic
 * is an ordinary movement — and a float would drift over a few hundred of
 * them. See `quantity.ts` in the shared package for the arithmetic.
 */
const quantity = (name: string) => numeric(name, { precision: 12, scale: 3 });

/* -------------------------------------------------------------------------- */
/* Suppliers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Who the clinic buys from.
 *
 * Soft-deleted for the same reason a lab is: purchases point at them, and a
 * supplier statement whose lines lose their name is unreadable. `is_active`
 * is the everyday switch that keeps a supplier out of the pickers.
 */
export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    name: text('name').notNull(),
    phone: text('phone'),
    contactPerson: text('contact_person'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [index('suppliers_clinic_idx').on(table.clinicId, table.name)],
);

/* -------------------------------------------------------------------------- */
/* Items                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A thing the clinic keeps in a cupboard.
 *
 * There is deliberately **no quantity column here** (CLAUDE.md: never a
 * stored, editable quantity). What is on the shelf is `sum(quantity)` over
 * this item's movements, and the only way to change it is to write one — which
 * is what makes the number explainable at any point in its history.
 *
 * `min_quantity` is the opposite kind of number: a target somebody chooses, not
 * a fact anyone observes, so it is a column and it is editable.
 *
 * `unit` never changes after creation (the update schema omits it): every
 * movement already recorded is a number *in that unit*, and reinterpreting
 * forty boxes as forty millilitres is not an edit, it is a fabrication.
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    nameAr: text('name_ar').notNull(),
    /** `item_category` and `item_unit` lookup codes, editable per clinic. */
    category: text('category').notNull(),
    unit: text('unit').notNull(),
    minQuantity: quantity('min_quantity').notNull().default('0'),
    /** Who this is normally bought from — prefilled on a purchase, never forced. */
    defaultSupplierId: uuid('default_supplier_id').references(() => suppliers.id),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('inventory_items_clinic_idx').on(table.clinicId, table.category, table.nameAr),
    index('inventory_items_supplier_idx').on(table.defaultSupplierId),
  ],
);

/* -------------------------------------------------------------------------- */
/* The ledger                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every reason a quantity ever changed.
 *
 * Append-only, like `charges`, `payments` and `lab_payments` before it
 * (CLAUDE.md architecture decision 2). There is no update and no delete: a
 * mistake is corrected by writing the negative of the entry with `reverses_id`
 * pointing back at it, so both rows stay on the item card and the sum comes
 * out right with no special case anywhere.
 *
 * The sign carries the meaning — purchase positive, consumption negative,
 * adjustment either way — and the service refuses a movement whose sign
 * disagrees with its type. `reason` is required on an adjustment and optional
 * elsewhere, which is also enforced in the service rather than by a check
 * constraint: the message a person reads matters more than the guarantee, and
 * both paths write through one method.
 *
 * `patient_id` and `performed_procedure_id` are what put a consumption on a
 * patient's timeline. They are nullable because most stock is used on nobody
 * in particular — a bottle of disinfectant is not billed to a mouth.
 *
 * There is no `updated_at`/`updated_by` pair: a row that is never updated has
 * no use for them. `reversed_at` is the one field that changes, and it is
 * bookkeeping — a back-pointer to the entry that undid this one.
 */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    itemId: uuid('item_id')
      .notNull()
      .references(() => inventoryItems.id),
    type: movementTypeEnum('type').notNull(),
    /** Signed. The item's quantity is the sum of this column. */
    quantity: quantity('quantity').notNull(),
    /** What one unit cost. Purchases only — it is what a statement totals. */
    unitPrice: money('unit_price'),
    /** A plain date: a batch goes off on a day, not at an instant. */
    expiryDate: date('expiry_date'),
    batchNo: text('batch_no'),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    patientId: uuid('patient_id').references(() => patients.id),
    performedProcedureId: uuid('performed_procedure_id').references(() => performedProcedures.id),
    reason: text('reason'),
    /** The entry this one cancels. Set only on a reversal. */
    reversesId: uuid('reverses_id'),
    /** Set on the original when a reversal is written against it. */
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
  },
  (table) => [
    /** The item card, newest first — and the sum behind every quantity. */
    index('stock_movements_item_idx').on(table.clinicId, table.itemId, table.createdAt),
    /** The supplier statement. */
    index('stock_movements_supplier_idx').on(table.clinicId, table.supplierId, table.createdAt),
    /** The patient timeline. */
    index('stock_movements_patient_idx').on(table.clinicId, table.patientId),
    index('stock_movements_procedure_idx').on(table.performedProcedureId),
    /** The batch view: purchases with an expiry, oldest first. */
    index('stock_movements_expiry_idx').on(table.clinicId, table.itemId, table.expiryDate),
    /** Finding the reversal that cancelled an entry, and refusing a second one. */
    index('stock_movements_reverses_idx').on(table.reversesId),
  ],
);
