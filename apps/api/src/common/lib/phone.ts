import {
  nationalPhoneDigits,
  normalizePhone,
  PHONE_DIAL_DIGITS,
  phoneDigitVariants,
} from "@clinic/shared";
import { eq, inArray, sql, type SQL } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";

export const phoneDigitsOf = (column: PgColumn | SQL): SQL =>
  sql`regexp_replace(regexp_replace(${column}, '[^0-9]', '', 'g'), '^00', '')`;

export const nationalPhoneDigitsOf = (column: PgColumn | SQL): SQL =>
  sql`regexp_replace(${phoneDigitsOf(column)}, ${sql.raw(`'^(${PHONE_DIAL_DIGITS.join("|")})0?'`)}, '')`;

export const phoneMatches = (column: PgColumn, phone: string): SQL =>
  inArray(phoneDigitsOf(column), phoneDigitVariants(phone));

export const typedPhoneMatches = (column: PgColumn, typed: string): SQL => {
  const value = typed.trim();

  return value.startsWith("+") || value.startsWith("00")
    ? phoneMatches(column, normalizePhone(value))
    : eq(nationalPhoneDigitsOf(column), nationalPhoneDigits(value));
};
