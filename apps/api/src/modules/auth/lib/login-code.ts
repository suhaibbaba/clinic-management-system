import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { LOGIN_CODE_LENGTH } from "@clinic/shared";

export function generateLoginCode(): string {
  return String(randomInt(0, 10 ** LOGIN_CODE_LENGTH)).padStart(LOGIN_CODE_LENGTH, "0");
}

export function hashLoginCode(userId: string, code: string): string {
  return createHash("sha256").update(`login-code:${userId}:${code}`).digest("hex");
}

export function loginCodeMatches(storedHash: string, userId: string, code: string): boolean {
  const given = Buffer.from(hashLoginCode(userId, code), "hex");
  const want = Buffer.from(storedHash, "hex");

  return given.length === want.length && timingSafeEqual(given, want);
}
