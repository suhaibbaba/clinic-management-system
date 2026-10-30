import type { ShoppingListLine } from "@clinic/shared";

export function purchaseLink(lines: readonly ShoppingListLine[]): string {
  const params = new URLSearchParams();

  for (const line of lines) {
    params.append("item", `${line.itemId}:${line.suggested}`);
  }

  const suppliers = new Set(lines.map((line) => line.supplierId));
  const [supplierId] = suppliers;

  if (suppliers.size === 1 && supplierId) {
    params.set("supplier", supplierId);
  }

  return `/inventory/purchases/new?${params.toString()}`;
}
