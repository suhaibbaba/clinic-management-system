import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { PORTAL_CODE_LENGTH } from "@clinic/shared";
import { sql, type SQL } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";
import { PORTAL_SESSION_BYTES } from "@api/modules/portal/constants";

export const phoneKey = (phone: string): string => phone.replaceAll(/\D/g, "").replace(/^00/, "");

export const phoneKeyOf = (column: PgColumn): SQL =>
  sql`regexp_replace(regexp_replace(${column}, '[^0-9]', '', 'g'), '^00', '')`;

export const generatePortalCode = (): string =>
  String(randomInt(0, 10 ** PORTAL_CODE_LENGTH)).padStart(PORTAL_CODE_LENGTH, "0");

export const hashPortalCode = (clinicId: string, phone: string, code: string): string =>
  createHash("sha256").update(`portal-code:${clinicId}:${phone}:${code}`).digest("hex");

export function portalCodeMatches(
  storedHash: string,
  clinicId: string,
  phone: string,
  code: string,
): boolean {
  const given = Buffer.from(hashPortalCode(clinicId, phone, code), "hex");
  const want = Buffer.from(storedHash, "hex");

  return given.length === want.length && timingSafeEqual(given, want);
}

export const generateSessionToken = (): string =>
  randomBytes(PORTAL_SESSION_BYTES).toString("base64url");

export const hashSessionToken = (token: string): string =>
  createHash("sha256").update(`portal-session:${token}`).digest("hex");
