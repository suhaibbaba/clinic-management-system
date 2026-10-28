import { MOVEMENT_TYPES } from "@clinic/shared";
import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clinics, users } from "@api/database/schema/core";
import { normalizedName } from "@api/database/schema/normalized-name";
import { patients, performedProcedures } from "@api/database/schema/patients";

export const movementTypeEnum = pgEnum("movement_type", MOVEMENT_TYPES);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

const softDeleteColumn = { deletedAt: timestamp("deleted_at", { withTimezone: true }) };

const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

const quantity = (name: string) => numeric(name, { precision: 12, scale: 3 });

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    name: text("name").notNull(),
    normalizedName: normalizedName("name"),
    phone: text("phone"),
    contactPerson: text("contact_person"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [index("suppliers_clinic_idx").on(table.clinicId, table.name)],
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    unit: text("unit").notNull(),
    minQuantity: quantity("min_quantity").notNull().default("0"),
    defaultSupplierId: uuid("default_supplier_id").references(() => suppliers.id),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("inventory_items_clinic_idx").on(table.clinicId, table.category, table.name),
    index("inventory_items_supplier_idx").on(table.defaultSupplierId),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    type: movementTypeEnum("type").notNull(),
    quantity: quantity("quantity").notNull(),
    unitPrice: money("unit_price"),
    expiryDate: date("expiry_date"),
    batchNo: text("batch_no"),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    patientId: uuid("patient_id").references(() => patients.id),
    performedProcedureId: uuid("performed_procedure_id").references(() => performedProcedures.id),
    reason: text("reason"),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    requestId: uuid("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    index("stock_movements_item_idx").on(table.clinicId, table.itemId, table.createdAt),
    index("stock_movements_supplier_idx").on(table.clinicId, table.supplierId, table.createdAt),
    index("stock_movements_patient_idx").on(table.clinicId, table.patientId),
    index("stock_movements_procedure_idx").on(table.performedProcedureId),
    index("stock_movements_expiry_idx").on(table.clinicId, table.itemId, table.expiryDate),
    index("stock_movements_reverses_idx").on(table.reversesId),
    uniqueIndex("stock_movements_request_uniq")
      .on(table.clinicId, table.requestId)
      .where(sql`request_id is not null`),
  ],
);

export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    movementId: uuid("movement_id").references(() => stockMovements.id),
    amount: money("amount").notNull(),
    method: text("method").notNull(),
    note: text("note"),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    paidBy: uuid("paid_by").references(() => users.id),
    requestId: uuid("request_id"),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    uniqueIndex("supplier_payments_request_uniq")
      .on(table.clinicId, table.requestId)
      .where(sql`request_id is not null`),
    index("supplier_payments_supplier_idx").on(table.clinicId, table.supplierId, table.createdAt),
    index("supplier_payments_reverses_idx").on(table.reversesId),
  ],
);

export const supplierOpeningBalances = pgTable(
  "supplier_opening_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    amount: money("amount").notNull(),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [index("supplier_opening_balances_supplier_idx").on(table.clinicId, table.supplierId)],
);
