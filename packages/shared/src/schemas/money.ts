import { z } from 'zod';

/** Money is `numeric(10,2)` in Postgres and a string in TS — never a float. Max 99999999.99. */
export const moneySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Expected an amount with at most two decimal places');

export type Money = z.infer<typeof moneySchema>;

/** Only the ledgers produce one: a reversing entry, or a balance where the patient is in credit. */
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

/** The sign is peeled off first: `Number('-100') * 100 + 50` lands on -9950 rather than -10050. */
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

// Write path only — a stray separator turns 6000 into 60.00. Storage stays `numeric(10,2)`; `60.00`
// is accepted so a read round-trips back, `60.50` is what this refuses.
export const wholeMoneySchema = z
  .string()
  .regex(/^\d{1,8}(\.0{1,2})?$/, 'Expected a whole amount')
  // Normalised on the way in, so the service and the database see one shape.
  .transform((value) => `${value.split('.')[0] ?? '0'}.00`);

export const isWholeMoney = (value: string): boolean => /^\d{1,8}(\.0{1,2})?$/.test(value);

// The symbol, never the ISO code. Takes a plain string rather than the `Currency` union, so a
// clinic row saved before the list existed still renders, falling back to the code.
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

// Not `Intl`: no float, and an Arabic locale would rewrite digits to Arabic-Indic and add bidi
// marks. Truncates rather than rounds, so it never prints a figure the ledger lacks.
export function formatWholeMoney(amount: string): string {
  const negative = amount.startsWith('-');
  const [whole = '0'] = (negative ? amount.slice(1) : amount).split('.');

  return `${negative ? '-' : ''}${whole}`;
}
