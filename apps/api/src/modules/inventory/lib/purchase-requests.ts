import {
  PURCHASE_REQUEST_STATUS,
  formatThousandths,
  toThousandths,
  type InventoryItemRow,
  type PurchaseRequestLine,
  type PurchaseRequestStatus,
} from "@clinic/shared";
import { purchaseRequestLines, purchaseRequests } from "@api/database/schema";

export type RequestRow = typeof purchaseRequests.$inferSelect;

type RequestLineRow = typeof purchaseRequestLines.$inferSelect;

export function toRequestLine(
  line: RequestLineRow,
  itemName: string,
  unit: string,
  received: number,
  lastPrice: string | null | undefined,
): PurchaseRequestLine {
  const wanted = toThousandths(line.quantity);

  return {
    id: line.id,
    itemId: line.itemId,
    itemName,
    unit,
    quantity: formatThousandths(wanted),
    received: formatThousandths(received),
    open: formatThousandths(Math.max(wanted - received, 0)),
    note: line.note,
    ...(lastPrice !== undefined && { lastPrice }),
  };
}

export function requestStatus(
  stored: PurchaseRequestStatus,
  lines: readonly PurchaseRequestLine[],
): PurchaseRequestStatus {
  if (stored !== PURCHASE_REQUEST_STATUS.REQUESTED && stored !== PURCHASE_REQUEST_STATUS.ORDERED) {
    return stored;
  }
  if (lines.length > 0 && lines.every((line) => toThousandths(line.open) === 0)) {
    return PURCHASE_REQUEST_STATUS.RECEIVED;
  }
  if (lines.some((line) => toThousandths(line.received) > 0)) {
    return PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED;
  }

  return stored;
}

export function suggestedQuantity(item: InventoryItemRow): string | null {
  const shortfall = toThousandths(item.minQuantity) * 2 - toThousandths(item.quantity);

  if (shortfall <= 0) {
    return null;
  }

  return formatThousandths(item.measured ? shortfall : Math.ceil(shortfall / 1000) * 1000);
}
