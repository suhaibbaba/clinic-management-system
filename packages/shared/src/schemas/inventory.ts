import { z } from 'zod';

import { MOVEMENT_TYPE, MOVEMENT_TYPES } from '@shared/enums';
import { isoDateSchema } from '@shared/schemas/appointments';
import { paginationQuerySchema, uuidSchema } from '@shared/schemas/common';
import { moneySchema, signedMoneySchema, wholeMoneySchema } from '@shared/schemas/money';
import { personNameSchema } from '@shared/schemas/person-name';
import {
  movementQuantitySchema,
  quantitySchema,
  signedQuantitySchema,
} from '@shared/schemas/quantity';
import { lookupCodeSchema } from '@shared/schemas/lookups';

/**
 * The store cupboard.
 *
 * One rule holds this module up, and it is the same one that holds up the two
 * ledgers before it (CLAUDE.md): **an item's quantity is the sum of its
 * movements**, computed on read, never a column anyone can type into. A count
 * that disagrees with reality is corrected by an `adjust` movement that says
 * why — which leaves the disagreement in the record, where somebody can learn
 * from it, instead of quietly overwriting it.
 */

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

/** A supplier with what the clinic has spent with them. */
export const supplierSummarySchema = supplierSchema.extend({
  /** Total of every purchase from them, reversals included. */
  purchased: signedMoneySchema,
  /** How many distinct items they supply by default. */
  itemCount: z.number().int().min(0),
});
export type SupplierSummary = z.infer<typeof supplierSummarySchema>;

const supplierWritableFields = {
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(32).nullish(),
  contactPerson: z.string().trim().max(160).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().optional(),
};

export const createSupplierSchema = z.object(supplierWritableFields);
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

/**
 * An update that changes nothing is a client bug, not a no-op — the same rule
 * the clinic settings schema follows. It is also what makes an unknown field
 * (`quantity`, say) a 400 rather than a silent success: Zod strips what it
 * does not know, and a request stripped down to nothing has asked for nothing.
 */
export const updateSupplierSchema = createSupplierSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const listSuppliersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(160).optional(),
  includeInactive: z.coerce.boolean().optional(),
});
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;

export const inventoryItemSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  nameAr: z.string(),
  category: lookupCodeSchema,
  /** Fixed for the item's life: it is what makes its movements summable. */
  unit: lookupCodeSchema,
  /** The level at which the clinic wants to be told to reorder. */
  minQuantity: quantitySchema,
  defaultSupplierId: uuidSchema.nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

/**
 * An item as a list draws it: the computed quantity and the three states a
 * clinic acts on.
 *
 * The flags are computed alongside the quantity rather than derived on the
 * client, because "low" is a comparison between two exact decimals and
 * "expiring" depends on a clinic setting — both belong where the numbers are.
 */
export const inventoryItemRowSchema = inventoryItemSchema.extend({
  /** `sum(quantity)` over every movement. Signed: a miscount can go below zero. */
  quantity: signedQuantitySchema,
  supplierName: z.string().nullable(),
  /** At or below the minimum — and the minimum is above zero. */
  isLow: z.boolean(),
  /** Some stock still on hand goes off within the clinic's warning window. */
  isExpiring: z.boolean(),
  /** Some stock still on hand has already gone off. */
  isExpired: z.boolean(),
  /** Earliest expiry among batches that still hold stock. */
  nearestExpiry: isoDateSchema.nullable(),
});
export type InventoryItemRow = z.infer<typeof inventoryItemRowSchema>;

const itemWritableFields = {
  nameAr: z.string().trim().min(2).max(160),
  category: lookupCodeSchema,
  unit: lookupCodeSchema,
  minQuantity: quantitySchema.optional(),
  defaultSupplierId: uuidSchema.nullish(),
  notes: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().optional(),
};

export const createInventoryItemSchema = z.object(itemWritableFields);
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

/**
 * The unit is not editable.
 *
 * Changing it would silently reinterpret every movement already recorded — 40
 * boxes becoming 40 millilitres — so an item counted in the wrong unit is
 * retired and replaced, which leaves its history readable.
 */
export const updateInventoryItemSchema = createInventoryItemSchema
  .omit({ unit: true })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

export const listInventoryItemsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(160).optional(),
  category: lookupCodeSchema.optional(),
  supplierId: uuidSchema.optional(),
  /** Only what needs reordering. */
  low: z.coerce.boolean().optional(),
  /** Only what is going off, or already has. */
  expiring: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().optional(),
});
export type ListInventoryItemsQuery = z.infer<typeof listInventoryItemsQuerySchema>;

export const stockMovementSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  itemId: uuidSchema,
  type: z.enum(MOVEMENT_TYPES),
  /** Signed: a purchase adds, a consumption subtracts, an adjustment does either. */
  quantity: signedQuantitySchema,
  /** What one unit cost, on a purchase. Null everywhere else. */
  unitPrice: moneySchema.nullable(),
  expiryDate: isoDateSchema.nullable(),
  batchNo: z.string().nullable(),
  supplierId: uuidSchema.nullable(),
  /** Set when stock was used on somebody — that is what puts it on their file. */
  patientId: uuidSchema.nullable(),
  performedProcedureId: uuidSchema.nullable(),
  /** Required on an adjustment: a count that changed for no stated reason is noise. */
  reason: z.string().nullable(),
  reversesId: uuidSchema.nullable(),
  reversedAt: z.iso.datetime().nullable(),
  createdBy: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

/** A movement as the item card draws it, with the names and the running total. */
export const stockMovementRowSchema = stockMovementSchema.extend({
  supplierName: z.string().nullable(),
  patientName: z.string().nullable(),
  procedureName: z.string().nullable(),
  createdByName: personNameSchema.nullable(),
  /** What the item stood at immediately after this movement. */
  runningQuantity: signedQuantitySchema,
});
export type StockMovementRow = z.infer<typeof stockMovementRowSchema>;

/**
 * Buying stock. Technician and admin (ROLES.md inventory matrix).
 *
 * The quantity is unsigned here and stored positive: which way a purchase
 * points is not a decision anyone gets to make on a form.
 */
export const purchaseStockSchema = z.object({
  itemId: uuidSchema,
  quantity: quantitySchema.refine((value) => Number(value) > 0, 'A purchase must be positive'),
  unitPrice: wholeMoneySchema.optional(),
  supplierId: uuidSchema.nullish(),
  batchNo: z.string().trim().max(64).nullish(),
  expiryDate: isoDateSchema.nullish(),
  reason: z.string().trim().max(500).nullish(),
});
export type PurchaseStockInput = z.infer<typeof purchaseStockSchema>;

/**
 * Using stock. Doctor, technician and admin — a doctor uses an ampoule and
 * says so, which is the only way the count ever matches the cupboard.
 *
 * Linking a patient is optional and linking a procedure narrows it further;
 * either one puts the consumption on that patient's timeline.
 */
export const consumeStockSchema = z.object({
  itemId: uuidSchema,
  quantity: quantitySchema.refine((value) => Number(value) > 0, 'A consumption must be positive'),
  patientId: uuidSchema.nullish(),
  performedProcedureId: uuidSchema.nullish(),
  batchNo: z.string().trim().max(64).nullish(),
  reason: z.string().trim().max(500).nullish(),
});
export type ConsumeStockInput = z.infer<typeof consumeStockSchema>;

/**
 * Correcting the count after a stock take. Technician and admin.
 *
 * Signed, because a count can be wrong in either direction, and the reason is
 * **required** — an adjustment is the one movement with no event behind it, so
 * the sentence somebody types is the entire explanation anyone will ever have.
 */
export const adjustStockSchema = z.object({
  itemId: uuidSchema,
  quantity: movementQuantitySchema,
  reason: z.string().trim().min(3).max(500),
  batchNo: z.string().trim().max(64).nullish(),
  expiryDate: isoDateSchema.nullish(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

/** Admin only, and it writes the opposite entry rather than touching the original. */
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

/** One batch of an item and what is left of it — derived, never stored. */
export const itemBatchSchema = z.object({
  batchNo: z.string().nullable(),
  expiryDate: isoDateSchema.nullable(),
  receivedAt: z.iso.datetime(),
  quantity: quantitySchema,
  remaining: quantitySchema,
  /** Already past its expiry date, with stock still against it. */
  isExpired: z.boolean(),
  /** Goes off inside the clinic's warning window. */
  isExpiring: z.boolean(),
});
export type ItemBatch = z.infer<typeof itemBatchSchema>;

export const itemBatchesSchema = z.object({
  itemId: uuidSchema,
  quantity: signedQuantitySchema,
  /** Stock held in batches nobody labelled — the remainder of the quantity. */
  unbatched: signedQuantitySchema,
  batches: z.array(itemBatchSchema),
});
export type ItemBatches = z.infer<typeof itemBatchesSchema>;

export const inventoryAlertsSchema = z.object({
  /** How many days ahead "expiring" looks — from clinic settings. */
  expiryWarningDays: z.number().int().min(1),
  low: z.array(inventoryItemRowSchema),
  expiring: z.array(inventoryItemRowSchema),
  expired: z.array(inventoryItemRowSchema),
});
export type InventoryAlerts = z.infer<typeof inventoryAlertsSchema>;

/**
 * One line of the shopping list.
 *
 * The suggestion is `min × 2 − current`: enough to clear the minimum and hold
 * the same amount again, so the clinic is not back here next week. It is a
 * starting figure on a printed sheet, not an order anybody is bound to.
 */
export const shoppingListLineSchema = z.object({
  itemId: uuidSchema,
  nameAr: z.string(),
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

export const supplierStatementLineSchema = z.object({
  movementId: uuidSchema,
  occurredAt: z.iso.datetime(),
  itemId: uuidSchema,
  itemName: z.string(),
  unit: lookupCodeSchema,
  quantity: signedQuantitySchema,
  unitPrice: moneySchema.nullable(),
  /** quantity × unit price, or null when the purchase carried no price. */
  total: signedMoneySchema.nullable(),
  batchNo: z.string().nullable(),
  isReversal: z.boolean(),
});
export type SupplierStatementLine = z.infer<typeof supplierStatementLineSchema>;

export const supplierStatementSchema = z.object({
  supplierId: uuidSchema,
  supplierName: z.string(),
  from: z.iso.datetime().nullable(),
  to: z.iso.datetime().nullable(),
  total: signedMoneySchema,
  lines: z.array(supplierStatementLineSchema),
});
export type SupplierStatement = z.infer<typeof supplierStatementSchema>;

export const statementRangeQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type StatementRangeQuery = z.infer<typeof statementRangeQuerySchema>;

/**
 * Inventory rules, in `clinics.settings.inventory`.
 *
 * How far ahead to warn is genuinely a clinic's own call: a practice that
 * orders monthly wants sixty days' notice, one that orders weekly finds that
 * much noise. Same lenient parse as the other settings blocks — a malformed
 * blob reads as the defaults rather than taking the store cupboard down.
 */
export const inventorySettingsSchema = z.object({
  expiryWarningDays: z.number().int().min(1).max(365).default(60),
});
export type InventorySettings = z.infer<typeof inventorySettingsSchema>;

export function inventorySettings(settings: unknown): InventorySettings {
  const raw =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)['inventory']
      : undefined;

  const parsed = inventorySettingsSchema.safeParse(raw ?? {});

  return parsed.success ? parsed.data : { expiryWarningDays: 60 };
}

/** The one place the type of a movement decides what a form may carry. */
export const movementInputFor = {
  [MOVEMENT_TYPE.PURCHASE]: purchaseStockSchema,
  [MOVEMENT_TYPE.CONSUME]: consumeStockSchema,
  [MOVEMENT_TYPE.ADJUST]: adjustStockSchema,
} as const;
