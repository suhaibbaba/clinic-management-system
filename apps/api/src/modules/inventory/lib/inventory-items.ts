import { inventoryItems } from "@api/database/schema";
import { type InventoryItem, type InventoryItemRow } from "@clinic/shared";
import { normalise, type ItemStock, isLowStock } from "@api/modules/inventory/lib/stock";

export type ItemRow = typeof inventoryItems.$inferSelect;

export function toInventoryItem(row: ItemRow): InventoryItem {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    category: row.category,
    unit: row.unit,
    minQuantity: normalise(row.minQuantity),
    defaultSupplierId: row.defaultSupplierId,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toItemRow(
  row: ItemRow,
  supplierName: string | null,
  stock: ItemStock | undefined,
): InventoryItemRow {
  const quantity = stock?.quantity ?? "0";

  return {
    ...toInventoryItem(row),
    quantity,
    supplierName,
    isLow: isLowStock(quantity, row.minQuantity),
    isExpiring: stock?.isExpiring ?? false,
    isExpired: stock?.isExpired ?? false,
    nearestExpiry: stock?.nearestExpiry ?? null,
  };
}
