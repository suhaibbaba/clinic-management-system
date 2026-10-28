import {
  MOVEMENT_TYPES,
  PAYMENT_DIRECTIONS,
  PURCHASE_DOCUMENT_STATUSES,
  RECEIPT_KINDS,
  PURCHASE_REQUEST_STATUSES,
  STOCK_COUNT_STATUSES,
  SUPPLIER_DOCUMENT_KINDS,
} from "@clinic/shared";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
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
export const purchaseDocumentStatusEnum = pgEnum(
  "purchase_document_status",
  PURCHASE_DOCUMENT_STATUSES,
);
export const receiptKindEnum = pgEnum("receipt_kind", RECEIPT_KINDS);
export const paymentDirectionEnum = pgEnum("supplier_payment_direction", PAYMENT_DIRECTIONS);
export const supplierDocumentKindEnum = pgEnum("supplier_document_kind", SUPPLIER_DOCUMENT_KINDS);
export const purchaseRequestStatusEnum = pgEnum(
  "purchase_request_status",
  PURCHASE_REQUEST_STATUSES,
);
export const stockCountStatusEnum = pgEnum("stock_count_status", STOCK_COUNT_STATUSES);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

const softDeleteColumn = { deletedAt: timestamp("deleted_at", { withTimezone: true }) };

const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

const quantity = (name: string) => numeric(name, { precision: 12, scale: 3 });

const amount = (name: string) => numeric(name, { precision: 12, scale: 2 });

const voidColumns = {
  status: purchaseDocumentStatusEnum("status").notNull().default("posted"),
  voidReason: text("void_reason"),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedBy: uuid("voided_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by"),
};

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
    hasExpiry: boolean("has_expiry").notNull().default(false),
    sensitive: boolean("sensitive").notNull().default(false),
    measured: boolean("measured").notNull().default(false),
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
    value: amount("value").notNull().default("0"),
    unknownQuantity: quantity("unknown_quantity").notNull().default("0"),
    receiptLineId: uuid("receipt_line_id"),
    occurredOn: date("occurred_on").notNull().defaultNow(),
    reasonCode: text("reason_code"),
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
    paidOn: date("paid_on").notNull().defaultNow(),
    direction: paymentDirectionEnum("direction").notNull().default("paid"),
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

export const stockReceipts = pgTable(
  "stock_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    number: text("number").notNull(),
    kind: receiptKindEnum("kind").notNull().default("receipt"),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    receivedOn: date("received_on").notNull(),
    note: text("note"),
    requestId: uuid("request_id"),
    ...voidColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("stock_receipts_number_uniq").on(table.clinicId, table.number),
    uniqueIndex("stock_receipts_request_uniq")
      .on(table.clinicId, table.requestId)
      .where(sql`request_id is not null`),
    index("stock_receipts_supplier_idx").on(table.clinicId, table.supplierId, table.receivedOn),
  ],
);

export const stockReceiptLines = pgTable(
  "stock_receipt_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => stockReceipts.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    quantity: quantity("quantity").notNull(),
    freeQuantity: quantity("free_quantity").notNull().default("0"),
    unitPrice: amount("unit_price"),
    purchaseUnit: text("purchase_unit"),
    unitsPerPurchaseUnit: quantity("units_per_purchase_unit").notNull().default("1"),
    batchNo: text("batch_no"),
    expiryDate: date("expiry_date"),
    requestLineId: uuid("request_line_id"),
    movementId: uuid("movement_id").references(() => stockMovements.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stock_receipt_lines_receipt_idx").on(table.receiptId),
    index("stock_receipt_lines_request_line_idx").on(table.requestLineId),
    uniqueIndex("stock_receipt_lines_movement_uniq").on(table.movementId),
  ],
);

export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    number: text("number").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    supplierRef: text("supplier_ref"),
    kind: supplierDocumentKindEnum("kind").notNull().default("invoice"),
    creditsInvoiceId: uuid("credits_invoice_id"),
    invoiceDate: date("invoice_date").notNull(),
    discountKind: text("discount_kind"),
    discountValue: amount("discount_value"),
    charges: amount("charges").notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
    taxAmount: amount("tax_amount"),
    subtotal: amount("subtotal").notNull(),
    invoiceDiscount: amount("invoice_discount").notNull().default("0"),
    total: amount("total").notNull(),
    variance: amount("variance").notNull().default("0"),
    note: text("note"),
    requestId: uuid("request_id"),
    ...voidColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("supplier_invoices_number_uniq").on(table.clinicId, table.number),
    uniqueIndex("supplier_invoices_request_uniq")
      .on(table.clinicId, table.requestId)
      .where(sql`request_id is not null`),
    uniqueIndex("supplier_invoices_reference_uniq")
      .on(table.clinicId, table.supplierId, sql`lower(${table.supplierRef})`)
      .where(sql`status = 'posted' and supplier_ref is not null`),
    index("supplier_invoices_supplier_idx").on(table.clinicId, table.supplierId, table.invoiceDate),
  ],
);

export const supplierInvoiceLines = pgTable(
  "supplier_invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => supplierInvoices.id),
    receiptLineId: uuid("receipt_line_id")
      .notNull()
      .references(() => stockReceiptLines.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    quantity: quantity("quantity").notNull(),
    freeQuantity: quantity("free_quantity").notNull().default("0"),
    unitPrice: amount("unit_price").notNull(),
    discountKind: text("discount_kind"),
    discountValue: amount("discount_value"),
    gift: boolean("gift").notNull().default(false),
    gross: amount("gross").notNull(),
    lineDiscount: amount("line_discount").notNull().default("0"),
    net: amount("net").notNull(),
    allocation: amount("allocation").notNull().default("0"),
    cost: amount("cost").notNull(),
    variance: amount("variance").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("supplier_invoice_lines_invoice_idx").on(table.invoiceId),
    index("supplier_invoice_lines_receipt_line_idx").on(table.receiptLineId),
  ],
);

export const supplierAllocations = pgTable(
  "supplier_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    paymentId: uuid("payment_id").references(() => supplierPayments.id),
    creditId: uuid("credit_id").references(() => supplierInvoices.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => supplierInvoices.id),
    amount: amount("amount").notNull(),
    reason: text("reason"),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    index("supplier_allocations_payment_idx").on(table.paymentId),
    index("supplier_allocations_invoice_idx").on(table.invoiceId),
    index("supplier_allocations_credit_idx").on(table.creditId),
    check(
      "supplier_allocations_one_source",
      sql`(payment_id is null) <> (credit_id is null)`,
    ),
  ],
);

export const documentCounters = pgTable(
  "document_counters",
  {
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    kind: text("kind").notNull(),
    year: integer("year").notNull(),
    last: integer("last").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.clinicId, table.kind, table.year] })],
);

export const lotBlocks = pgTable(
  "lot_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    batchNo: text("batch_no").notNull(),
    reason: text("reason").notNull(),
    liftedAt: timestamp("lifted_at", { withTimezone: true }),
    liftedBy: uuid("lifted_by"),
    liftReason: text("lift_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    uniqueIndex("lot_blocks_active_uniq")
      .on(table.clinicId, table.itemId, table.batchNo)
      .where(sql`lifted_at is null`),
    index("lot_blocks_item_idx").on(table.clinicId, table.itemId),
  ],
);

export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    number: text("number").notNull(),
    status: purchaseRequestStatusEnum("status").notNull().default("requested"),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    neededBy: date("needed_by"),
    note: text("note"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentTo: text("sent_to"),
    sentBy: uuid("sent_by"),
    cancelReason: text("cancel_reason"),
    requestId: uuid("request_id"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("purchase_requests_number_uniq").on(table.clinicId, table.number),
    uniqueIndex("purchase_requests_request_uniq")
      .on(table.clinicId, table.requestId)
      .where(sql`request_id is not null`),
    index("purchase_requests_status_idx").on(table.clinicId, table.status, table.createdAt),
  ],
);

export const purchaseRequestLines = pgTable(
  "purchase_request_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    requestId: uuid("request_id")
      .notNull()
      .references(() => purchaseRequests.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    quantity: quantity("quantity").notNull(),
    note: text("note"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("purchase_request_lines_request_idx").on(table.requestId)],
);

export const stockCounts = pgTable(
  "stock_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    number: text("number").notNull(),
    status: stockCountStatusEnum("status").notNull().default("open"),
    note: text("note"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("stock_counts_number_uniq").on(table.clinicId, table.number),
    uniqueIndex("stock_counts_open_uniq")
      .on(table.clinicId)
      .where(sql`status = 'open'`),
  ],
);

export const stockCountLines = pgTable(
  "stock_count_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    countId: uuid("count_id")
      .notNull()
      .references(() => stockCounts.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    expected: quantity("expected").notNull(),
    counted: quantity("counted"),
    movementId: uuid("movement_id").references(() => stockMovements.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [uniqueIndex("stock_count_lines_item_uniq").on(table.countId, table.itemId)],
);

export const itemPackSizes = pgTable(
  "item_pack_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    unit: text("unit").notNull(),
    unitsPer: quantity("units_per").notNull(),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    uniqueIndex("item_pack_sizes_active_uniq")
      .on(
        table.clinicId,
        table.itemId,
        table.unit,
        sql`coalesce(${table.supplierId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`archived_at is null`),
  ],
);
