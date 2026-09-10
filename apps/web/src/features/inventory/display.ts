import {
  ITEM_CATEGORY,
  MOVEMENT_TYPE,
  compareQuantity,
  quantityToNumber,
  toThousandths,
  type InventoryItemRow,
  type MovementType,
} from '@clinic/shared';

import type { BadgeTone } from '@web/components/ui/badge';
import type { ProgressTone } from '@web/components/ui/progress-bar';

// The bar, the badge and the row all consult this, so a category cannot be amber in one place and
// grey in another. A clinic's own category gets the neutral badge.
const CATEGORY_TONES: Record<string, BadgeTone> = {
  [ITEM_CATEGORY.MEDICATION]: 'info',
  [ITEM_CATEGORY.CONSUMABLE]: 'neutral',
  [ITEM_CATEGORY.TOOL]: 'neutral',
  [ITEM_CATEGORY.STERILIZATION]: 'success',
};

export const categoryTone = (category: string): BadgeTone => CATEGORY_TONES[category] ?? 'neutral';

export const movementLabel = (type: MovementType): string => `inventory.movements.${type}`;

export const MOVEMENT_TONES: Record<MovementType, BadgeTone> = {
  [MOVEMENT_TYPE.PURCHASE]: 'success',
  [MOVEMENT_TYPE.CONSUME]: 'info',
  // An adjustment is the one movement with no event behind it, so it is the
  // one worth noticing in a list of forty.
  [MOVEMENT_TYPE.ADJUST]: 'warning',
};

// Below the minimum is `danger` because it is a problem rather than a small number; up to twice it
// is `warning` — still fine, but the week to order.
export function stockTone(item: InventoryItemRow): ProgressTone {
  if (item.isLow) {
    return 'danger';
  }

  const minimum = toThousandths(item.minQuantity);

  if (minimum > 0 && compareQuantity(item.quantity, doubled(item.minQuantity)) <= 0) {
    return 'warning';
  }

  return 'primary';
}

// Twice the minimum, so the minimum sits at the halfway mark and "how close am I to reordering" is
// read rather than calculated.
export function stockScale(item: InventoryItemRow): { value: number; total: number } {
  const minimum = toThousandths(item.minQuantity);
  const quantity = Math.max(quantityToNumber(item.quantity), 0);

  return minimum > 0
    ? { value: quantity, total: (minimum / 1000) * 2 }
    : { value: quantity, total: Math.max(quantity, 1) };
}

const doubled = (quantity: string): string => {
  const thousandths = toThousandths(quantity) * 2;
  const fraction = String(Math.abs(thousandths) % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');

  return fraction === ''
    ? String(Math.trunc(thousandths / 1000))
    : `${Math.trunc(thousandths / 1000)}.${fraction}`;
};
