import { z } from 'zod';

/**
 * Money is `numeric(10, 2)` in Postgres and a **string** in TypeScript —
 * never a float (CLAUDE.md). Ten digits of precision with two decimals means
 * at most 99999999.99.
 */
export const moneySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Expected an amount with at most two decimal places');

export type Money = z.infer<typeof moneySchema>;

/** Adds two money strings without ever going through a float. */
export function addMoney(left: Money, right: Money): Money {
  return formatMinorUnits(toMinorUnits(left) + toMinorUnits(right));
}

export function subtractMoney(left: Money, right: Money): Money {
  return formatMinorUnits(toMinorUnits(left) - toMinorUnits(right));
}

/** Amount in cents, as an integer — the only safe way to do arithmetic here. */
export function toMinorUnits(value: Money): number {
  const [whole = '0', fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function formatMinorUnits(minorUnits: number): Money {
  const sign = minorUnits < 0 ? '-' : '';
  const absolute = Math.abs(minorUnits);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}
