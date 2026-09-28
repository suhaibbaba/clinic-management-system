import type { ItemBatch } from "@clinic/shared";
import { UNBATCHED_ROW_KEY } from "@web/modules/inventory/constants";

export interface ShelfRow {
  readonly key: string;
  readonly batchNo: string | null;
  readonly expiryDate: string | null;
  readonly receivedAt: string | null;
  readonly remaining: string;
  readonly quantity: string | null;
  readonly isExpired: boolean;
  readonly isExpiring: boolean;
}

export const byExpiry = (a: ItemBatch, b: ItemBatch): number =>
  (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999") ||
  a.receivedAt.localeCompare(b.receivedAt);

export function shelfRows(batches: readonly ItemBatch[], unbatched: string): ShelfRow[] {
  return [
    ...batches
      .filter((batch) => Number(batch.remaining) > 0)
      .sort(byExpiry)
      .map((batch) => ({ ...batch, key: `${batch.batchNo ?? "none"}-${batch.receivedAt}` })),
    ...(Number(unbatched) > 0
      ? [
          {
            key: UNBATCHED_ROW_KEY,
            batchNo: null,
            expiryDate: null,
            receivedAt: null,
            remaining: unbatched,
            quantity: null,
            isExpired: false,
            isExpiring: false,
          },
        ]
      : []),
  ];
}
