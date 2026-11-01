import { z } from "zod";
import {
  CLINIC_MODULES,
  LANGUAGE_CODES,
  SPECIALTY_CODE,
  phoneSchema,
  type LanguageCode,
  type LocalizedText,
} from "@clinic/shared";

const list = <T extends z.ZodType<unknown, string>>(item: T) =>
  z
    .string()
    .trim()
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(z.array(item));

const optionalText = z.string().trim().min(1).max(120).optional();

const languageFields = <P extends string>(prefix: P) =>
  Object.fromEntries(
    LANGUAGE_CODES.map((code) => [`${prefix}_${code.toUpperCase()}`, optionalText]),
  ) as Record<`${P}_${Uppercase<LanguageCode>}`, typeof optionalText>;

const NAMED = ["BOOTSTRAP_CLINIC_NAME", "BOOTSTRAP_ADMIN_FIRST_NAME", "BOOTSTRAP_ADMIN_LAST_NAME"];

export function languageText(env: object, prefix: string): LocalizedText {
  const source = env as Record<string, unknown>;

  return Object.fromEntries(
    LANGUAGE_CODES.flatMap((code) => {
      const value = source[`${prefix}_${code.toUpperCase()}`];

      return typeof value === "string" && value !== "" ? [[code, value]] : [];
    }),
  ) as LocalizedText;
}

export const bootstrapEnvSchema = z
  .object({
    BOOTSTRAP_CLINIC_SLUG: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/),
    ...languageFields("BOOTSTRAP_CLINIC_NAME"),
    BOOTSTRAP_SPECIALTIES: list(z.enum(Object.values(SPECIALTY_CODE))).refine(
      (codes) => codes.length > 0,
      "At least one specialty is required",
    ),
    BOOTSTRAP_MODULES: list(z.enum(CLINIC_MODULES)).default([]),
    BOOTSTRAP_SITE_DOMAIN: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9.-]+$/)
      .optional(),
    BOOTSTRAP_CURRENCY: z.string().trim().length(3).toUpperCase().optional(),
    BOOTSTRAP_COUNTRY: z.string().trim().length(2).toUpperCase().default("PS"),
    BOOTSTRAP_TIMEZONE: z.string().trim().min(1).optional(),
    ...languageFields("BOOTSTRAP_ADMIN_FIRST_NAME"),
    ...languageFields("BOOTSTRAP_ADMIN_LAST_NAME"),
    BOOTSTRAP_ADMIN_PHONE: phoneSchema,
    BOOTSTRAP_ADMIN_EMAIL: z.email().optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(10).optional(),
  })
  .superRefine((env, context) => {
    for (const prefix of NAMED) {
      if (Object.keys(languageText(env, prefix)).length === 0) {
        context.addIssue({
          code: "custom",
          path: [`${prefix}_${LANGUAGE_CODES[0].toUpperCase()}`],
          message: `${prefix} needs at least one language`,
        });
      }
    }
  });

export type BootstrapEnv = z.infer<typeof bootstrapEnvSchema>;
