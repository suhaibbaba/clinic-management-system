import type { ItemStock } from "@api/modules/inventory/lib/stock";

export const INVENTORY_ITEMS_ENTITY = "inventory_items";

export const STOCK_MOVEMENTS_ENTITY = "stock_movements";

export const EMPTY: ItemStock = {
  quantity: "0",
  batches: [],
  unbatched: "0",
  nearestExpiry: null,
  isExpiring: false,
  isExpired: false,
};

export const SUPPLIERS_ENTITY = "suppliers";
