import { z } from 'zod';

import { settingsSchema, weeklyScheduleSchema } from '@shared/schemas/common';
import { personNameInputSchema, personNameSchema } from '@shared/schemas/person-name';
import { DEFAULT_TIME_ZONE } from '@shared/time/zone';

// A closed list: a typo would quietly relabel every figure. Adding one needs its i18n label and its
// `CURRENCY_SYMBOLS` symbol too.
export const CURRENCIES = ['JOD', 'ILS', 'USD', 'EUR', 'SAR', 'SYP'] as const;
export type Currency = (typeof CURRENCIES)[number];

// In the settings blob rather than columns, so adding one is not a migration; parsed leniently so a
// malformed blob degrades to defaults.
export const clinicScheduleSettingsSchema = z.object({
  /** IANA zone the clinic's opening hours are expressed in. */
  timezone: z.string().min(1).default(DEFAULT_TIME_ZONE),
});
export type ClinicScheduleSettings = z.infer<typeof clinicScheduleSettingsSchema>;

/** Never throws: unreadable settings must not stop the calendar from loading. */
export function clinicScheduleSettings(settings: unknown): ClinicScheduleSettings {
  const parsed = clinicScheduleSettingsSchema.safeParse(settings ?? {});

  return parsed.success ? parsed.data : { timezone: DEFAULT_TIME_ZONE };
}

// The language is the clinic's, not the reader's: a receipt should not change language because a
// locum switched the interface.
export const documentSettingsSchema = z.object({
  language: z.enum(['ar', 'en']).default('ar'),
});
export type DocumentSettings = z.infer<typeof documentSettingsSchema>;

export function documentSettings(settings: unknown): DocumentSettings {
  const raw =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)['documents']
      : undefined;

  const parsed = documentSettingsSchema.safeParse(raw ?? {});

  return parsed.success ? parsed.data : { language: 'ar' };
}

/** Small on purpose: fetched on every page load and drawn into every PDF the clinic prints. */
export const MAX_CLINIC_LOGO_BYTES = 2 * 1024 * 1024;

/** No SVG — it can carry script and is rendered inside the app's own origin. */
export const ALLOWED_CLINIC_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const clinicLogoMimeSchema = z.enum(ALLOWED_CLINIC_LOGO_MIME_TYPES);
export type ClinicLogoMime = z.infer<typeof clinicLogoMimeSchema>;

export const presignClinicLogoSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: clinicLogoMimeSchema,
  sizeBytes: z.number().int().positive().max(MAX_CLINIC_LOGO_BYTES),
});
export type PresignClinicLogoInput = z.infer<typeof presignClinicLogoSchema>;

export const presignClinicLogoResponseSchema = z.object({
  key: z.string(),
  uploadUrl: z.url(),
  expiresAt: z.iso.datetime(),
  maxSizeBytes: z.number().int().positive(),
});
export type PresignClinicLogoResponse = z.infer<typeof presignClinicLogoResponseSchema>;

/** Called once the client has PUT the object; the API reads the bytes back. */
export const confirmClinicLogoSchema = z.object({
  key: z.string().trim().min(1).max(512),
});
export type ConfirmClinicLogoInput = z.infer<typeof confirmClinicLogoSchema>;

/** Pre-auth: no phone, no address, and no indication of how many clinics this deployment serves. */
export const clinicBrandingSchema = z.object({
  name: personNameSchema.nullable(),
  logoUrl: z.url().nullable(),
});
export type ClinicBranding = z.infer<typeof clinicBrandingSchema>;

export const clinicSchema = z.object({
  id: z.uuid(),
  name: personNameSchema,
  /** R2 object key — never a public URL (CLAUDE.md files & images). */
  logoKey: z.string().nullable(),
  /** Short-lived signed URL for `logoKey`, minted per response. */
  logoUrl: z.url().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  // Read as a plain string, not the enum: a row stored before the list existed must still parse, or
  // the settings screen cannot load to fix it.
  currency: z.string(),
  workingHours: weeklyScheduleSchema,
  settings: settingsSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Clinic = z.infer<typeof clinicSchema>;

export const updateClinicSchema = z
  .object({
    name: personNameInputSchema,
    phone: z.string().trim().max(32).nullish(),
    email: z.email().max(255).nullish(),
    address: z.string().trim().max(500).nullish(),
    /** Writes are held to the list, even though reads are not. */
    currency: z.enum(CURRENCIES),
    workingHours: weeklyScheduleSchema,
    settings: settingsSchema,
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
