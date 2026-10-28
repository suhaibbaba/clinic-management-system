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

export const STOCK_MOVEMENTS_REQUEST_INDEX = "stock_movements_request_uniq";

export const SUPPLIER_PAYMENTS_REQUEST_INDEX = "supplier_payments_request_uniq";
