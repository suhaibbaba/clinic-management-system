import { z } from 'zod';

// `numeric(12,3)`, a string, never a float — half the units are continuous and 200 doses of 0.1
// drift. The unit is never in the string; an item keeps one for life.
export const quantitySchema = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, 'Expected a quantity with at most three decimal places');

export type Quantity = z.infer<typeof quantitySchema>;

// A consumption is negative, an adjustment may go either way, and a balance below zero is a wrong
// count rather than an error to hide.
export const signedQuantitySchema = z
  .string()
  .regex(/^-?\d{1,9}(\.\d{1,3})?$/, 'Expected a quantity with at most three decimal places');

/** A movement's own quantity: signed, and never zero — a no-op is not a movement. */
export const movementQuantitySchema = signedQuantitySchema.refine(
  (value) => toThousandths(value) !== 0,
  'A movement cannot be zero',
);

const SCALE = 1000;

// The sign is peeled off before the parts combine, as money does it: `Number('-2') * 1000 + 500`
// lands on -1500.
export function toThousandths(value: string): number {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const magnitude = Number(whole) * SCALE + Number(fraction.padEnd(3, '0').slice(0, 3));

  return negative ? -magnitude : magnitude;
}

// A display convention applied at the edge — `2.000 قطعة` reads as a milligram measurement.
// Comparisons happen in thousandths above.
export function formatThousandths(thousandths: number): string {
  const sign = thousandths < 0 ? '-' : '';
  const absolute = Math.abs(thousandths);
  const whole = Math.floor(absolute / SCALE);
  const fraction = String(absolute % SCALE)
    .padStart(3, '0')
    .replace(/0+$/, '');

  return fraction === '' ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

export function addQuantity(left: string, right: string): string {
  return formatThousandths(toThousandths(left) + toThousandths(right));
}

export function subtractQuantity(left: string, right: string): string {
  return formatThousandths(toThousandths(left) - toThousandths(right));
}

export function negateQuantity(value: string): string {
  return formatThousandths(-toThousandths(value));
}

export function compareQuantity(left: string, right: string): number {
  return toThousandths(left) - toThousandths(right);
}

// For a bar or a chart only — anything deciding "is this below its minimum" belongs in
// `compareQuantity`.
export const quantityToNumber = (value: string): number => toThousandths(value) / SCALE;
