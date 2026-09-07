import { z } from 'zod';

/**
 * A stock quantity: `numeric(12, 3)` in Postgres and a **string** here.
 *
 * The same rule money follows, for the same reason (CLAUDE.md: never a float)
 * — and stock needs it just as much, because half the units are continuous.
 * A clinic buys 500 ml of solution and uses 2.5 ml at a time; two hundred
 * doses of `0.1` added as floats drift by more than a dose. Three decimals is
 * the smallest anyone measures in practice (a gram to the milligram), and nine
 * whole digits is more of anything than a clinic will ever hold.
 *
 * The unit itself is never in the string. An item is counted in exactly one
 * unit for its whole life, so the number is comparable with its own minimum
 * and summable across its own movements — and never across two items.
 */
export const quantitySchema = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, 'Expected a quantity with at most three decimal places');

export type Quantity = z.infer<typeof quantitySchema>;

/**
 * A quantity that may be negative.
 *
 * The ledger's own shape: a consumption is written negative, an adjustment may
 * go either way, and a reversing entry carries the negative of what it undoes.
 * A *balance* can also come out negative — stock counted down past zero — and
 * that is not an error to hide but the sign that the count is wrong.
 */
export const signedQuantitySchema = z
  .string()
  .regex(/^-?\d{1,9}(\.\d{1,3})?$/, 'Expected a quantity with at most three decimal places');

/** A movement's own quantity: signed, and never zero — a no-op is not a movement. */
export const movementQuantitySchema = signedQuantitySchema.refine(
  (value) => toThousandths(value) !== 0,
  'A movement cannot be zero',
);

const SCALE = 1000;

/**
 * Thousandths, as an integer — the only safe way to do arithmetic here.
 *
 * The sign is peeled off before the parts are combined, exactly as money does
 * it: `Number('-2') * 1000 + 500` lands on -1500 rather than -2500, and half
 * this ledger is negative.
 */
export function toThousandths(value: string): number {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const magnitude = Number(whole) * SCALE + Number(fraction.padEnd(3, '0').slice(0, 3));

  return negative ? -magnitude : magnitude;
}

/**
 * Back to a string, with the trailing zeros trimmed.
 *
 * `2.000` is written `2`, because a screen full of `2.000 قطعة` reads as a
 * measurement taken to the milligram rather than as two of something. The
 * precision is still there — it is a display convention applied at the edge,
 * and every comparison happens in thousandths above.
 */
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

/** Compares two quantities exactly: negative, zero or positive, like a sort. */
export function compareQuantity(left: string, right: string): number {
  return toThousandths(left) - toThousandths(right);
}

/**
 * For a progress bar, a percentage, a chart — never for a comparison.
 *
 * Named so that a float sneaking into a total is visible in review: anything
 * that decides "is this below its minimum" belongs in `compareQuantity`.
 */
export const quantityToNumber = (value: string): number => toThousandths(value) / SCALE;
