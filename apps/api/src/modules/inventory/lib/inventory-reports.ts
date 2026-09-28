import {
  type InventoryItemRow,
  toThousandths,
  type ShoppingListLine,
  formatThousandths,
  subtractQuantity,
  compareQuantity,
  toMinorUnits,
  formatMinorUnits,
} from "@clinic/shared";

export function byUrgency(left: InventoryItemRow, right: InventoryItemRow): number {
  const shortfall = (item: InventoryItemRow): number =>
    toThousandths(item.minQuantity) - toThousandths(item.quantity);

  return shortfall(right) - shortfall(left);
}

export function byExpiry(left: InventoryItemRow, right: InventoryItemRow): number {
  return (left.nearestExpiry ?? "9999-12-31").localeCompare(right.nearestExpiry ?? "9999-12-31");
}

export function toShoppingLine(item: InventoryItemRow): ShoppingListLine {
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
    supplierName: item.supplierName,
  };
}

export function lineTotal(quantity: string, unitPrice: string): string {
  const millionths = toThousandths(quantity) * toMinorUnits(unitPrice);

  return formatMinorUnits(Math.round(millionths / 1000));
}
