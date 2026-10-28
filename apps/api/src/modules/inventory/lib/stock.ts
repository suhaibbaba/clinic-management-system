import { type ItemBatch, toThousandths, compareQuantity, formatThousandths } from "@clinic/shared";

export interface ItemStock {
  readonly quantity: string;
  readonly batches: ItemBatch[];
  readonly unbatched: string;
  readonly nearestExpiry: string | null;
  readonly isExpiring: boolean;
  readonly isExpired: boolean;
}

export const isLowStock = (quantity: string, minQuantity: string): boolean =>
  toThousandths(minQuantity) > 0 && compareQuantity(quantity, minQuantity) <= 0;

export function normalise(value: string): string {
  return formatThousandths(toThousandths(value));
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export interface UseSlice {
  readonly batchNo: string | null;
  readonly thousandths: number;
}

export function fefoSlices(batches: readonly ItemBatch[], wanted: number): UseSlice[] {
  const slices: UseSlice[] = [];
  let left = wanted;

  for (const batch of batches) {
    if (left === 0) {
      break;
    }
    if (batch.batchNo === null || batch.isExpired) {
      continue;
    }

    const taken = Math.min(toThousandths(batch.remaining), left);

    if (taken > 0) {
      slices.push({ batchNo: batch.batchNo, thousandths: taken });
      left -= taken;
    }
  }

  return left > 0 ? [...slices, { batchNo: null, thousandths: left }] : slices;
}
