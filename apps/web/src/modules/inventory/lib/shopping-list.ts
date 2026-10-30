import type { ShoppingListLine } from "@clinic/shared";
import { PICK_PARAM, RETURN_PARAM, SHOPPING_LIST_PATH } from "@web/modules/inventory/constants";

export function shoppingListLink(itemIds: readonly string[]): string {
  const params = new URLSearchParams();

  for (const itemId of itemIds) {
    params.append(PICK_PARAM, itemId);
  }

  const query = params.toString();

  return query === "" ? SHOPPING_LIST_PATH : `${SHOPPING_LIST_PATH}?${query}`;
}

export function purchaseLink(
  lines: readonly ShoppingListLine[],
  returnTo: string | null = null,
): string {
  const params = new URLSearchParams();

  for (const line of lines) {
    params.append("item", `${line.itemId}:${line.suggested}`);
  }

  const suppliers = new Set(lines.map((line) => line.supplierId));
  const [supplierId] = suppliers;

  if (suppliers.size === 1 && supplierId) {
    params.set("supplier", supplierId);
  }

  if (returnTo !== null) {
    params.set(RETURN_PARAM, returnTo);
  }

  return `/inventory/purchases/new?${params.toString()}`;
}

export interface SupplierGroup {
  readonly supplierId: string | null;
  readonly supplierName: string | null;
  readonly lines: readonly ShoppingListLine[];
}

export function bySupplier(lines: readonly ShoppingListLine[]): SupplierGroup[] {
  const groups = new Map<string | null, SupplierGroup>();

  for (const line of lines) {
    const group = groups.get(line.supplierId);

    groups.set(line.supplierId, {
      supplierId: line.supplierId,
      supplierName: line.supplierName,
      lines: [...(group?.lines ?? []), line],
    });
  }

  return [...groups.values()].sort(
    (a, b) =>
      Number(a.supplierId === null) - Number(b.supplierId === null) ||
      (a.supplierName ?? "").localeCompare(b.supplierName ?? ""),
  );
}
