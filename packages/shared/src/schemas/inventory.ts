import { z } from "zod";
import {
  MOVEMENT_TYPE,
  MOVEMENT_TYPES,
  PURCHASE_DOCUMENT_STATUSES,
  PURCHASE_REQUEST_STATUSES,
  STOCK_COUNT_STATUSES,
  SUPPLIER_DOCUMENT_KINDS,
} from "@shared/enums";
import { DISCOUNT_KIND } from "@shared/schemas/purchase-invoice";
import { isoDateSchema } from "@shared/schemas/appointments";
import {
  paginationQuerySchema,
  phoneSchema,
  uuidSchema,
  optionalPhoneSchema,
} from "@shared/schemas/common";
import { moneySchema, signedMoneySchema } from "@shared/schemas/money";
import { personNameSchema } from "@shared/schemas/person-name";
import {
  movementQuantitySchema,
  quantitySchema,
  signedQuantitySchema,
} from "@shared/schemas/quantity";
import { lookupCodeSchema } from "@shared/schemas/lookups";

export const supplierSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  name: z.string(),
  phone: z.string().nullable(),
  contactPerson: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Supplier = z.infer<typeof supplierSchema>;

export const supplierSummarySchema = supplierSchema.extend({
  openingBalance: signedMoneySchema.optional(),
  purchased: signedMoneySchema.optional(),
  paid: signedMoneySchema.optional(),
  balance: signedMoneySchema.optional(),
  lastPurchaseAt: z.iso.datetime().nullable(),
});
export type SupplierSummary = z.infer<typeof supplierSummarySchema>;

const supplierWritableFields = {
  name: z.string().trim().min(2).max(160),
  phone: optionalPhoneSchema,
  contactPerson: z.string().trim().max(160).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().optional(),
  openingBalance: moneySchema.optional(),
};

export const createSupplierSchema = z.object(supplierWritableFields);
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const listSuppliersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(160).optional(),
  includeInactive: z.coerce.boolean().optional(),
});
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;

export const inventoryItemSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  name: z.string(),
  category: lookupCodeSchema,
  unit: lookupCodeSchema,
  minQuantity: quantitySchema,
  defaultSupplierId: uuidSchema.nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  hasExpiry: z.boolean(),
  sensitive: z.boolean(),
  measured: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const inventoryItemRowSchema = inventoryItemSchema.extend({
  quantity: signedQuantitySchema,
  supplierName: z.string().nullable(),
  isLow: z.boolean(),
  isExpiring: z.boolean(),
  isExpired: z.boolean(),
  nearestExpiry: isoDateSchema.nullable(),
});
export type InventoryItemRow = z.infer<typeof inventoryItemRowSchema>;

const itemWritableFields = {
  name: z.string().trim().min(2).max(160),
  category: lookupCodeSchema,
  unit: lookupCodeSchema,
  minQuantity: quantitySchema.optional(),
  defaultSupplierId: uuidSchema.nullish(),
  notes: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().optional(),
  hasExpiry: z.boolean().optional(),
  sensitive: z.boolean().optional(),
  measured: z.boolean().optional(),
};

export const createInventoryItemSchema = z.object(itemWritableFields);
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = createInventoryItemSchema
  .omit({ unit: true })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

export const listInventoryItemsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(160).optional(),
  category: lookupCodeSchema.optional(),
  supplierId: uuidSchema.optional(),
  low: z.coerce.boolean().optional(),
  expiring: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().optional(),
});
export type ListInventoryItemsQuery = z.infer<typeof listInventoryItemsQuerySchema>;

export const stockMovementSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  itemId: uuidSchema,
  type: z.enum(MOVEMENT_TYPES),
  quantity: signedQuantitySchema,
  unitPrice: moneySchema.nullable().optional(),
  expiryDate: isoDateSchema.nullable(),
  batchNo: z.string().nullable(),
  supplierId: uuidSchema.nullable(),
  patientId: uuidSchema.nullable(),
  performedProcedureId: uuidSchema.nullable(),
  reason: z.string().nullable(),
  reversesId: uuidSchema.nullable(),
  reversedAt: z.iso.datetime().nullable(),
  createdBy: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

export const stockMovementRowSchema = stockMovementSchema.extend({
  supplierName: z.string().nullable(),
  patientName: z.string().nullable(),
  procedureName: z.string().nullable(),
  createdByName: personNameSchema.nullable(),
  runningQuantity: signedQuantitySchema,
});
export type StockMovementRow = z.infer<typeof stockMovementRowSchema>;

export const purchaseStockSchema = z
  .object({
    itemId: uuidSchema,
    quantity: quantitySchema.refine((value) => Number(value) > 0, "A purchase must be positive"),
    unitPrice: moneySchema.optional(),
    supplierId: uuidSchema.nullish(),
    paidNow: moneySchema.optional(),
    paymentMethod: lookupCodeSchema.optional(),
    requestId: uuidSchema.optional(),
    batchNo: z.string().trim().max(64).nullish(),
    expiryDate: isoDateSchema.nullish(),
    reason: z.string().trim().max(500).nullish(),
  })
  .refine(
    (input) =>
      !input.paidNow ||
      Number(input.paidNow) === 0 ||
      (Boolean(input.supplierId) && input.unitPrice !== undefined && Boolean(input.paymentMethod)),
    {
      message: "A payment at purchase needs a supplier, a unit price and a method",
      path: ["paidNow"],
    },
  );
export type PurchaseStockInput = z.infer<typeof purchaseStockSchema>;

export const consumeStockSchema = z.object({
  itemId: uuidSchema,
  quantity: quantitySchema.refine((value) => Number(value) > 0, "A consumption must be positive"),
  patientId: uuidSchema.nullish(),
  performedProcedureId: uuidSchema.nullish(),
  batchNo: z.string().trim().max(64).nullish(),
  reason: z.string().trim().max(500).nullish(),
  requestId: uuidSchema.optional(),
});
export type ConsumeStockInput = z.infer<typeof consumeStockSchema>;

export const adjustStockSchema = z.object({
  itemId: uuidSchema,
  quantity: movementQuantitySchema,
  reason: z.string().trim().min(3).max(500),
  batchNo: z.string().trim().max(64).nullish(),
  expiryDate: isoDateSchema.nullish(),
  requestId: uuidSchema.optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const correctPurchaseSchema = z.object({
  quantity: quantitySchema.refine((value) => Number(value) > 0, "A purchase must be positive"),
  unitPrice: moneySchema.optional(),
  reason: z.string().trim().min(3).max(500),
});
export type CorrectPurchaseInput = z.infer<typeof correctPurchaseSchema>;

export const reverseMovementSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type ReverseMovementInput = z.infer<typeof reverseMovementSchema>;

export const listMovementsQuerySchema = paginationQuerySchema.extend({
  type: z.enum(MOVEMENT_TYPES).optional(),
  itemId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  patientId: uuidSchema.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;

export const itemBatchSchema = z.object({
  batchNo: z.string().nullable(),
  expiryDate: isoDateSchema.nullable(),
  receivedAt: z.iso.datetime(),
  quantity: quantitySchema,
  remaining: quantitySchema,
  isExpired: z.boolean(),
  isExpiring: z.boolean(),
  blockId: uuidSchema.nullable(),
});
export type ItemBatch = z.infer<typeof itemBatchSchema>;

export const itemBatchesSchema = z.object({
  itemId: uuidSchema,
  quantity: signedQuantitySchema,
  unbatched: signedQuantitySchema,
  batches: z.array(itemBatchSchema),
});
export type ItemBatches = z.infer<typeof itemBatchesSchema>;

export const inventoryAlertsSchema = z.object({
  expiryWarningDays: z.number().int().min(1),
  low: z.array(inventoryItemRowSchema),
  expiring: z.array(inventoryItemRowSchema),
  expired: z.array(inventoryItemRowSchema),
});
export type InventoryAlerts = z.infer<typeof inventoryAlertsSchema>;

export const shoppingListLineSchema = z.object({
  itemId: uuidSchema,
  name: z.string(),
  category: lookupCodeSchema,
  unit: lookupCodeSchema,
  quantity: signedQuantitySchema,
  minQuantity: quantitySchema,
  suggested: quantitySchema,
  supplierName: z.string().nullable(),
});
export type ShoppingListLine = z.infer<typeof shoppingListLineSchema>;

export const shoppingListSchema = z.object({
  generatedAt: z.iso.datetime(),
  lines: z.array(shoppingListLineSchema),
});
export type ShoppingList = z.infer<typeof shoppingListSchema>;

export const SUPPLIER_ENTRY_KIND = {
  OPENING: "opening",
  PURCHASE: "purchase",
  PAYMENT: "payment",
  CREDIT: "credit",
} as const;
export type SupplierEntryKind = (typeof SUPPLIER_ENTRY_KIND)[keyof typeof SUPPLIER_ENTRY_KIND];

export const supplierStatementEntrySchema = z.object({
  id: z.string(),
  kind: z.enum([
    SUPPLIER_ENTRY_KIND.OPENING,
    SUPPLIER_ENTRY_KIND.PURCHASE,
    SUPPLIER_ENTRY_KIND.PAYMENT,
    SUPPLIER_ENTRY_KIND.CREDIT,
  ]),
  occurredAt: z.iso.datetime(),
  itemId: uuidSchema.nullable(),
  itemName: z.string().nullable(),
  unit: lookupCodeSchema.nullable(),
  quantity: signedQuantitySchema.nullable(),
  unitPrice: moneySchema.nullable(),
  method: lookupCodeSchema.nullable(),
  note: z.string().nullable(),
  reference: z.string().nullable(),
  amount: signedMoneySchema.nullable(),
  runningBalance: signedMoneySchema,
  isReversal: z.boolean(),
  isReversed: z.boolean(),
});
export type SupplierStatementEntry = z.infer<typeof supplierStatementEntrySchema>;

export const supplierStatementSchema = z.object({
  supplierId: uuidSchema,
  supplierName: z.string(),
  from: z.iso.datetime().nullable(),
  to: z.iso.datetime().nullable(),
  openingBalance: signedMoneySchema,
  purchased: signedMoneySchema,
  paid: signedMoneySchema,
  closingBalance: signedMoneySchema,
  entries: z.array(supplierStatementEntrySchema),
});
export type SupplierStatement = z.infer<typeof supplierStatementSchema>;

export const supplierPaymentSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  supplierId: uuidSchema,
  movementId: uuidSchema.nullable(),
  amount: signedMoneySchema,
  method: lookupCodeSchema,
  note: z.string().nullable(),
  reversesId: uuidSchema.nullable(),
  reversedAt: z.iso.datetime().nullable(),
  paidBy: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type SupplierPayment = z.infer<typeof supplierPaymentSchema>;

export const createSupplierPaymentSchema = z.object({
  supplierId: uuidSchema,
  paidOn: isoDateSchema.optional(),
  amount: moneySchema.refine((value) => Number(value) > 0, "A payment must be greater than zero"),
  method: lookupCodeSchema,
  note: z.string().trim().max(500).nullish(),
  requestId: uuidSchema.optional(),
});
export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;

export const reverseSupplierPaymentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type ReverseSupplierPaymentInput = z.infer<typeof reverseSupplierPaymentSchema>;

export const statementRangeQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type StatementRangeQuery = z.infer<typeof statementRangeQuerySchema>;

export const inventorySettingsSchema = z.object({
  expiryWarningDays: z.number().int().min(1).max(365).default(60),
});
export type InventorySettings = z.infer<typeof inventorySettingsSchema>;

export function inventorySettings(settings: unknown): InventorySettings {
  const raw =
    typeof settings === "object" && settings !== null
      ? (settings as Record<string, unknown>)["inventory"]
      : undefined;

  const parsed = inventorySettingsSchema.safeParse(raw ?? {});

  return parsed.success ? parsed.data : { expiryWarningDays: 60 };
}

export const movementInputFor = {
  [MOVEMENT_TYPE.PURCHASE]: purchaseStockSchema,
  [MOVEMENT_TYPE.CONSUME]: consumeStockSchema,
  [MOVEMENT_TYPE.ADJUST]: adjustStockSchema,
} as const;

const discountSchema = z.object({
  kind: z.enum([DISCOUNT_KIND.PERCENT, DISCOUNT_KIND.AMOUNT]),
  value: moneySchema,
});

export const purchaseLineSchema = z.object({
  itemId: uuidSchema,
  requestLineId: uuidSchema.optional(),
  quantity: quantitySchema,
  freeQuantity: quantitySchema.optional(),
  unitPrice: moneySchema.optional(),
  discount: discountSchema.optional(),
  gift: z.boolean().optional(),
  batchNo: z.string().trim().max(64).nullish(),
  expiryDate: isoDateSchema.nullish(),
});
export type PurchaseLineInput = z.infer<typeof purchaseLineSchema>;

export const invoiceTermsSchema = z.object({
  supplierRef: z.string().trim().max(64).nullish(),
  discount: discountSchema.optional(),
  charges: moneySchema.optional(),
  taxRate: z
    .string()
    .regex(/^\d{1,2}(\.\d{1,2})?$/)
    .optional(),
  taxAmount: moneySchema.optional(),
  applyCredit: z.boolean().optional(),
});

export const postPurchaseSchema = z
  .object({
    supplierId: uuidSchema.nullish(),
    date: isoDateSchema,
    lines: z.array(purchaseLineSchema).min(1).max(200),
    invoice: invoiceTermsSchema.nullish(),
    paidNow: moneySchema.optional(),
    paymentMethod: lookupCodeSchema.optional(),
    note: z.string().trim().max(500).nullish(),
    requestId: uuidSchema.optional(),
  })
  .refine((input) => !input.invoice || Boolean(input.supplierId), {
    message: "An invoice needs a supplier",
    path: ["supplierId"],
  })
  .refine((input) => !input.paidNow || (Boolean(input.invoice) && Boolean(input.paymentMethod)), {
    message: "A payment needs an invoice and a method",
    path: ["paidNow"],
  });
export type PostPurchaseInput = z.infer<typeof postPurchaseSchema>;

export const invoiceReceiptsSchema = invoiceTermsSchema.extend({
  supplierId: uuidSchema,
  date: isoDateSchema,
  lines: z
    .array(
      z.object({
        receiptLineId: uuidSchema,
        unitPrice: moneySchema,
        discount: discountSchema.optional(),
        gift: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(200),
  note: z.string().trim().max(500).nullish(),
  requestId: uuidSchema.optional(),
});
export type InvoiceReceiptsInput = z.infer<typeof invoiceReceiptsSchema>;

export const voidDocumentSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export type VoidDocumentInput = z.infer<typeof voidDocumentSchema>;

export const reallocatePaymentSchema = z.object({
  allocations: z.array(z.object({ invoiceId: uuidSchema, amount: moneySchema })).max(100),
  reason: z.string().trim().min(3).max(500),
});
export type ReallocatePaymentInput = z.infer<typeof reallocatePaymentSchema>;

export const supplierRefundSchema = z.object({
  supplierId: uuidSchema,
  amount: moneySchema.refine((value) => Number(value) > 0, "A refund must be greater than zero"),
  method: lookupCodeSchema,
  paidOn: isoDateSchema.optional(),
  note: z.string().trim().max(500).nullish(),
  requestId: uuidSchema.optional(),
});
export type SupplierRefundInput = z.infer<typeof supplierRefundSchema>;

export const purchaseResultSchema = z.object({
  receiptId: uuidSchema,
  receiptNumber: z.string(),
  invoiceId: uuidSchema.nullable(),
  invoiceNumber: z.string().nullable(),
  total: moneySchema.nullable(),
  paymentId: uuidSchema.nullable(),
  movementIds: z.array(uuidSchema),
});
export type PurchaseResult = z.infer<typeof purchaseResultSchema>;

export const supplierInvoiceSummarySchema = z.object({
  id: uuidSchema,
  kind: z.enum(SUPPLIER_DOCUMENT_KINDS),
  number: z.string(),
  supplierRef: z.string().nullable(),
  invoiceDate: isoDateSchema,
  status: z.enum(PURCHASE_DOCUMENT_STATUSES),
  total: moneySchema,
  paid: moneySchema,
  open: signedMoneySchema,
});
export type SupplierInvoiceSummary = z.infer<typeof supplierInvoiceSummarySchema>;

export const uninvoicedLineSchema = z.object({
  receiptLineId: uuidSchema,
  receiptNumber: z.string(),
  receivedOn: isoDateSchema,
  itemId: uuidSchema,
  itemName: z.string(),
  unit: lookupCodeSchema,
  quantity: quantitySchema,
  freeQuantity: quantitySchema,
  unitPrice: moneySchema.nullable(),
});
export type UninvoicedLine = z.infer<typeof uninvoicedLineSchema>;

const positiveQuantity = quantitySchema.refine((value) => Number(value) > 0, "Must be positive");
const positiveMoney = moneySchema.refine((value) => Number(value) > 0, "Must be positive");
const batchNoSchema = z.string().trim().min(1).max(64);

export const writeOffSchema = z.object({
  itemId: uuidSchema,
  quantity: positiveQuantity,
  batchNo: batchNoSchema.nullish(),
  reasonCode: lookupCodeSchema,
  note: z.string().trim().max(500).nullish(),
  date: isoDateSchema.optional(),
  requestId: uuidSchema.optional(),
});
export type WriteOffInput = z.infer<typeof writeOffSchema>;

export const blockLotSchema = z.object({
  batchNo: batchNoSchema,
  reason: z.string().trim().min(3).max(500),
});
export type BlockLotInput = z.infer<typeof blockLotSchema>;

export const liftLotBlockSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export type LiftLotBlockInput = z.infer<typeof liftLotBlockSchema>;

export const lotUseSchema = z.object({
  movementId: uuidSchema,
  patientId: uuidSchema.nullable(),
  patientName: z.string().nullable(),
  quantity: quantitySchema,
  usedAt: z.iso.datetime(),
});
export type LotUse = z.infer<typeof lotUseSchema>;

export const lotBlockSchema = z.object({
  id: uuidSchema,
  itemId: uuidSchema,
  itemName: z.string(),
  unit: lookupCodeSchema,
  batchNo: z.string(),
  expiryDate: isoDateSchema.nullable(),
  reason: z.string(),
  blockedAt: z.iso.datetime(),
  blockedByName: personNameSchema.nullable(),
  liftedAt: z.iso.datetime().nullable(),
  remaining: signedQuantitySchema,
  uses: z.array(lotUseSchema),
});
export type LotBlock = z.infer<typeof lotBlockSchema>;

export const listLotBlocksQuerySchema = z.object({
  itemId: uuidSchema.optional(),
  includeLifted: z.coerce.boolean().optional(),
});
export type ListLotBlocksQuery = z.infer<typeof listLotBlocksQuerySchema>;

export const supplierReturnSchema = z.object({
  supplierId: uuidSchema,
  date: isoDateSchema,
  lines: z
    .array(
      z.object({
        itemId: uuidSchema,
        quantity: positiveQuantity,
        batchNo: batchNoSchema.nullish(),
      }),
    )
    .min(1)
    .max(200),
  credit: z
    .object({
      amount: positiveMoney,
      supplierRef: z.string().trim().max(64).nullish(),
    })
    .nullish(),
  note: z.string().trim().max(500).nullish(),
  requestId: uuidSchema.optional(),
});
export type SupplierReturnInput = z.infer<typeof supplierReturnSchema>;

export const supplierReturnResultSchema = z.object({
  returnId: uuidSchema,
  returnNumber: z.string(),
  value: moneySchema.optional(),
  creditNoteId: uuidSchema.nullable(),
  creditNoteNumber: z.string().nullable(),
});
export type SupplierReturnResult = z.infer<typeof supplierReturnResultSchema>;

export const priceDocumentSchema = z
  .object({
    supplierId: uuidSchema,
    date: isoDateSchema,
    supplierRef: z.string().trim().max(64).nullish(),
    invoiceId: uuidSchema.nullish(),
    amount: positiveMoney.optional(),
    lines: z
      .array(z.object({ receiptLineId: uuidSchema, amount: positiveMoney }))
      .max(200)
      .optional(),
    note: z.string().trim().max(500).nullish(),
    requestId: uuidSchema.optional(),
  })
  .refine((input) => (input.lines?.length ?? 0) > 0 || input.amount !== undefined, {
    message: "A credit or supplementary invoice needs an amount or lines",
    path: ["amount"],
  });
export type PriceDocumentInput = z.infer<typeof priceDocumentSchema>;

const requestLineInputSchema = z.object({
  itemId: uuidSchema,
  quantity: positiveQuantity,
  note: z.string().trim().max(200).nullish(),
});

export const createPurchaseRequestSchema = z.object({
  supplierId: uuidSchema.nullish(),
  neededBy: isoDateSchema.nullish(),
  note: z.string().trim().max(500).nullish(),
  lines: z.array(requestLineInputSchema).min(1).max(200),
  requestId: uuidSchema.optional(),
});
export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;

export const updatePurchaseRequestSchema = createPurchaseRequestSchema.omit({ requestId: true });
export type UpdatePurchaseRequestInput = z.infer<typeof updatePurchaseRequestSchema>;

export const requestBelowMinimumSchema = z.object({
  supplierId: uuidSchema.nullish(),
});
export type RequestBelowMinimumInput = z.infer<typeof requestBelowMinimumSchema>;

export const sendPurchaseRequestSchema = z.object({
  to: phoneSchema.optional(),
  withPrices: z.boolean().optional(),
});
export type SendPurchaseRequestInput = z.infer<typeof sendPurchaseRequestSchema>;

export const cancelPurchaseRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type CancelPurchaseRequestInput = z.infer<typeof cancelPurchaseRequestSchema>;

export const listPurchaseRequestsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PURCHASE_REQUEST_STATUSES).optional(),
  supplierId: uuidSchema.optional(),
});
export type ListPurchaseRequestsQuery = z.infer<typeof listPurchaseRequestsQuerySchema>;

export const purchaseRequestLineSchema = z.object({
  id: uuidSchema,
  itemId: uuidSchema,
  itemName: z.string(),
  unit: lookupCodeSchema,
  quantity: quantitySchema,
  received: quantitySchema,
  open: quantitySchema,
  note: z.string().nullable(),
  lastPrice: moneySchema.nullable().optional(),
});
export type PurchaseRequestLine = z.infer<typeof purchaseRequestLineSchema>;

export const purchaseRequestSchema = z.object({
  id: uuidSchema,
  number: z.string(),
  status: z.enum(PURCHASE_REQUEST_STATUSES),
  supplierId: uuidSchema.nullable(),
  supplierName: z.string().nullable(),
  supplierPhone: z.string().nullable(),
  neededBy: isoDateSchema.nullable(),
  note: z.string().nullable(),
  sentAt: z.iso.datetime().nullable(),
  sentTo: z.string().nullable(),
  cancelReason: z.string().nullable(),
  createdByName: personNameSchema.nullable(),
  createdAt: z.iso.datetime(),
  lines: z.array(purchaseRequestLineSchema),
});
export type PurchaseRequest = z.infer<typeof purchaseRequestSchema>;

export const createStockCountSchema = z.object({
  itemIds: z.array(uuidSchema).max(1000).optional(),
  note: z.string().trim().max(500).nullish(),
});
export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;

export const recordCountsSchema = z.object({
  lines: z
    .array(z.object({ itemId: uuidSchema, counted: quantitySchema.nullable() }))
    .min(1)
    .max(1000),
});
export type RecordCountsInput = z.infer<typeof recordCountsSchema>;

export const stockCountLineSchema = z.object({
  itemId: uuidSchema,
  itemName: z.string(),
  unit: lookupCodeSchema,
  expected: signedQuantitySchema,
  current: signedQuantitySchema,
  counted: quantitySchema.nullable(),
  difference: signedQuantitySchema.nullable(),
  value: signedMoneySchema.nullable().optional(),
});
export type StockCountLine = z.infer<typeof stockCountLineSchema>;

export const stockCountSchema = z.object({
  id: uuidSchema,
  number: z.string(),
  status: z.enum(STOCK_COUNT_STATUSES),
  note: z.string().nullable(),
  snapshotAt: z.iso.datetime(),
  postedAt: z.iso.datetime().nullable(),
  createdByName: personNameSchema.nullable(),
  lines: z.array(stockCountLineSchema),
});
export type StockCount = z.infer<typeof stockCountSchema>;

export const stockCountSummarySchema = stockCountSchema.omit({ lines: true }).extend({
  items: z.number().int(),
  counted: z.number().int(),
});
export type StockCountSummary = z.infer<typeof stockCountSummarySchema>;
