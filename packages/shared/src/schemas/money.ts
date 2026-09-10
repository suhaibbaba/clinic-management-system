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

/**
 * What a **money input** accepts: a whole number of the currency's major unit.
 *
 * The clinics this serves price in whole units — a filling is 60, not 60.00 —
 * and the two decimals were pure ceremony that showed up in every field, every
 * table and every printed sheet as ".00". Worse, they were a way to get a
 * price wrong: a stray separator turns 6000 into 60.00.
 *
 * **Storage is unchanged.** The column stays `numeric(10, 2)` and every read
 * schema stays `moneySchema`: the ledgers already hold values with fractions,
 * arithmetic on them is exact either way, and a migration that rounded live
 * balances to fix a data-entry preference would be the wrong trade entirely.
 * This is the write path and the display layer agreeing on whole numbers,
 * which is what CLAUDE.md now records.
 *
 * Accepted: `60`, `0`, and `60.00` — the last because a value round-tripping
 * from a read (`numeric` always renders its scale) must be resubmittable.
 * Refused: `60.50`, which is what the rule exists to catch.
 */
export const wholeMoneySchema = z
  .string()
  .regex(/^\d{1,8}(\.0{1,2})?$/, 'Expected a whole amount')
  // Normalised on the way in, so the service and the database see one shape.
  .transform((value) => `${value.split('.')[0] ?? '0'}.00`);

/** Whether a string is a whole amount, for a form to check before it submits. */
export const isWholeMoney = (value: string): boolean => /^\d{1,8}(\.0{1,2})?$/.test(value);

/**
 * What a reader sees beside an amount: the **symbol**, never the code.
 *
 * "150 USD" is how a system talks to itself. A receipt handed to a patient says
 * "150 $", and a Jordanian clinic's says "150 د.ا" — the symbol is the word for
 * money in the place the clinic is, and the ISO code is an implementation
 * detail that leaked onto every screen.
 *
 * Keyed by ISO-4217 because that is what the clinic setting stores. A currency
 * with no entry falls back to its own code, which is honest rather than blank —
 * and is the reason `currencySymbol` takes a plain string rather than the
 * `Currency` union: a clinic row saved before the list existed can hold
 * anything, and the settings screen it would be corrected on is the one screen
 * that must not fail to render.
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  JOD: 'د.ا',
  ILS: '₪',
  USD: '$',
  EUR: '€',
  SAR: 'ر.س',
  SYP: 'ل.س',
  AED: 'د.إ',
  EGP: 'ج.م',
  TRY: '₺',
  GBP: '£',
};

export function currencySymbol(code: string | undefined): string {
  if (!code) {
    return '';
  }

  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

/**
 * An amount as it is written, with no decimals and no currency.
 *
 * Not `Intl.NumberFormat`: the value is a `numeric(10,2)` string that must
 * never pass through a float, and an Arabic locale would rewrite the digits
 * into Arabic-Indic and wrap them in bidi marks — which is exactly what the
 * `<Ltr>` island around every figure exists to prevent.
 *
 * Truncates rather than rounds. Every amount this system writes is whole, so
 * the only fractions left are historic ledger rows, and showing 60 for a stored
 * 60.99 understates a debt by less than a unit — where rounding it to 61 would
 * print a figure the ledger does not hold.
 */
export function formatWholeMoney(amount: string): string {
  const negative = amount.startsWith('-');
  const [whole = '0'] = (negative ? amount.slice(1) : amount).split('.');

  return `${negative ? '-' : ''}${whole}`;
}
