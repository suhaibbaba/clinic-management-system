import { z } from "zod";
import { CLINIC_MODULES, SPECIALTY_CODE, phoneSchema } from "@clinic/shared";

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

const requiredText = z.string().trim().min(1).max(120);

export const bootstrapEnvSchema = z.object({
  BOOTSTRAP_CLINIC_SLUG: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/),
  BOOTSTRAP_CLINIC_NAME_AR: requiredText,
  BOOTSTRAP_CLINIC_NAME_EN: requiredText,
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
  BOOTSTRAP_CURRENCY: z.string().trim().length(3).toUpperCase().default("ILS"),
  BOOTSTRAP_COUNTRY: z.string().trim().length(2).toUpperCase().default("PS"),
  BOOTSTRAP_TIMEZONE: z.string().trim().min(1).default("Asia/Hebron"),
  BOOTSTRAP_ADMIN_FIRST_NAME_AR: requiredText,
  BOOTSTRAP_ADMIN_LAST_NAME_AR: requiredText,
  BOOTSTRAP_ADMIN_FIRST_NAME_EN: requiredText,
  BOOTSTRAP_ADMIN_LAST_NAME_EN: requiredText,
  BOOTSTRAP_ADMIN_PHONE: phoneSchema,
  BOOTSTRAP_ADMIN_EMAIL: z.email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(10).optional(),
});

export type BootstrapEnv = z.infer<typeof bootstrapEnvSchema>;
