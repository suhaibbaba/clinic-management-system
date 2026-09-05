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

/**
 * Money that may be negative.
 *
 * Only the ledgers produce one: a reversing entry carries the negative of what
 * it cancels, and a balance goes negative when a patient is in credit.
 */
export const signedMoneySchema = z
  .string()
  .regex(/^-?\d{1,8}(\.\d{1,2})?$/, 'Expected an amount with at most two decimal places');

/** Adds two money strings without ever going through a float. */
export function addMoney(left: Money, right: Money): Money {
  return formatMinorUnits(toMinorUnits(left) + toMinorUnits(right));
}

export function subtractMoney(left: Money, right: Money): Money {
  return formatMinorUnits(toMinorUnits(left) - toMinorUnits(right));
}

/**
 * Amount in cents, as an integer — the only safe way to do arithmetic here.
 *
 * The sign is peeled off first: `Number('-100') * 100 + 50` would land on
 * -9950 rather than -10050, and the ledger's reversing entries are negative.
 */
export function toMinorUnits(value: Money): number {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const magnitude = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  return negative ? -magnitude : magnitude;
}

export function formatMinorUnits(minorUnits: number): Money {
  const sign = minorUnits < 0 ? '-' : '';
  const absolute = Math.abs(minorUnits);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}
