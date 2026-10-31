import {
  type InventoryItemRow,
  toThousandths,
  type ShoppingListLine,
  formatThousandths,
  subtractQuantity,
  compareQuantity,
} from "@clinic/shared";

export function byUrgency(left: InventoryItemRow, right: InventoryItemRow): number {
  const shortfall = (item: InventoryItemRow): number =>
    toThousandths(item.minQuantity) - toThousandths(item.quantity);

  return shortfall(right) - shortfall(left);
}

export function byExpiry(left: InventoryItemRow, right: InventoryItemRow): number {
  return (left.nearestExpiry ?? "9999-12-31").localeCompare(right.nearestExpiry ?? "9999-12-31");
}

export function toShoppingLine(
  item: InventoryItemRow,
  lastPrice: string | null | undefined,
): ShoppingListLine {
  const target = formatThousandths(toThousandths(item.minQuantity) * 2);
  const suggested = subtractQuantity(target, item.quantity);

  return {
    itemId: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity,
    minQuantity: item.minQuantity,
    suggested: compareQuantity(suggested, "0") > 0 ? suggested : "0",
    supplierId: item.defaultSupplierId,
    supplierName: item.supplierName,
    ...(lastPrice !== undefined && { lastPrice }),
  };
}
