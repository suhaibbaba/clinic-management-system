import { z } from "zod";
import { EXCLUSION_VIOLATION } from "@api/common/constants/postgres-errors";
import { type PersonName, type BookingSettings } from "@clinic/shared";
import { createHash } from "node:crypto";

export const slugParamSchema = z.object({
  clinicSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Not a clinic handle"),
});

export const tokenParamSchema = z.object({ token: z.string().min(10).max(400) });

export const isOverlapConflict = (error: unknown): boolean => {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === EXCLUSION_VIOLATION
    ) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
};

export const phoneDigits = (phone: string): string => phone.replaceAll(/[^\d]/g, "");

export interface ClinicContext {
  readonly id: string;
  readonly name: PersonName;
  readonly logoKey: string | null;
  readonly phone: string | null;
  readonly country: string;
  readonly timeZone: string;
  readonly booking: BookingSettings;
}

export const hashCode = (code: string): string => createHash("sha256").update(code).digest("hex");
