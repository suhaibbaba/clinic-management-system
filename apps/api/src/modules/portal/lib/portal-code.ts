import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { canonicalPhoneDigits, PORTAL_CODE_LENGTH } from "@clinic/shared";
import { PORTAL_SESSION_BYTES } from "@api/modules/portal/constants";

export const phoneKey = (phone: string): string => canonicalPhoneDigits(phone);

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
