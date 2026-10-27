import type { ItemStock } from "@api/modules/inventory/lib/stock";

export const EMPTY: ItemStock = {
  quantity: "0",
  batches: [],
  unbatched: "0",
  nearestExpiry: null,
  isExpiring: false,
  isExpired: false,
};

export const SUPPLIER_PAYMENT_CAPABILITY = "supplier-payments.create";
