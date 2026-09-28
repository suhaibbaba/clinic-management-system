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
