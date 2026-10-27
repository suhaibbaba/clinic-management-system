import { PHONE_DIAL_DIGITS, phoneDigitVariants } from "@clinic/shared";
import { inArray, sql, type SQL } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";

export const phoneDigitsOf = (column: PgColumn | SQL): SQL =>
  sql`regexp_replace(regexp_replace(${column}, '[^0-9]', '', 'g'), '^00', '')`;

export const nationalPhoneDigitsOf = (column: PgColumn | SQL): SQL =>
  sql`regexp_replace(${phoneDigitsOf(column)}, ${sql.raw(`'^(${PHONE_DIAL_DIGITS.join("|")})0?'`)}, '')`;

export const phoneMatches = (column: PgColumn, phone: string): SQL =>
  inArray(phoneDigitsOf(column), phoneDigitVariants(phone));
