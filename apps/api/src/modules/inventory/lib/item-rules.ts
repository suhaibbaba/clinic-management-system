import { STOCK_ERROR, toThousandths } from "@clinic/shared";
import { type ItemRow } from "@api/modules/inventory/lib/inventory-items";

type ItemFlags = Pick<ItemRow, "hasExpiry" | "sensitive" | "measured">;

export function wholeUnitError(item: ItemFlags, quantity: string): string | null {
  return !item.measured && toThousandths(quantity) % 1000 !== 0 ? STOCK_ERROR.WHOLE_UNITS : null;
}

export function receiptLineError(
  item: ItemFlags,
  line: {
    readonly batchNo?: string | null | undefined;
    readonly expiryDate?: string | null | undefined;
  },
): string | null {
  if (item.sensitive && !line.batchNo) {
    return STOCK_ERROR.LOT_REQUIRED;
  }
  if ((item.hasExpiry || item.sensitive) && !line.expiryDate) {
    return STOCK_ERROR.EXPIRY_REQUIRED;
  }

  return null;
}
