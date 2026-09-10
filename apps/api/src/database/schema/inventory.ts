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

// Three decimals because half the units are continuous — 2.5 ml of anaesthetic is an ordinary
// movement, and a float drifts over a few hundred of them.
const quantity = (name: string) => numeric(name, { precision: 12, scale: 3 });

// Soft-deleted because purchases point at them: a statement whose lines lose their supplier's name
// is unreadable. `is_active` keeps one out of the pickers.
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

// No quantity column: what is on the shelf is `sum(quantity)` over the movements. `unit` never
// changes, or every movement already recorded is reinterpreted.
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

// Append-only; the sign carries the meaning and the service refuses one that disagrees with its
// type. `patient_id` is nullable because most stock is used on nobody in particular.
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
    reversesId: uuid('reverses_id'),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
  },
  (table) => [
    index('stock_movements_item_idx').on(table.clinicId, table.itemId, table.createdAt),
    index('stock_movements_supplier_idx').on(table.clinicId, table.supplierId, table.createdAt),
    index('stock_movements_patient_idx').on(table.clinicId, table.patientId),
    index('stock_movements_procedure_idx').on(table.performedProcedureId),
    /** The batch view: purchases with an expiry, oldest first. */
    index('stock_movements_expiry_idx').on(table.clinicId, table.itemId, table.expiryDate),
    /** Finding the reversal that cancelled an entry, and refusing a second one. */
    index('stock_movements_reverses_idx').on(table.reversesId),
  ],
);
