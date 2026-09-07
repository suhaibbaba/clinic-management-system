import { z } from 'zod';

import { settingsSchema, weeklyScheduleSchema } from '@shared/schemas/common';

/**
 * The currencies a clinic may be billed in, as ISO-4217 codes.
 *
 * A closed list rather than any three letters: money is formatted, printed on
 * receipts and totalled per clinic, and a typo ("USE") would have quietly
 * relabelled every figure in the system. Adding one is a line here plus its
 * label in the i18n files.
 */
export const CURRENCIES = ['USD', 'ILS'] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * The scheduling keys inside `clinics.settings`.
 *
 * In the free-form settings blob rather than in columns of their own because
 * they are configuration a clinic edits, not data other tables reference —
 * and because adding one is then a line here rather than a migration. Parsed
 * with `clinicScheduleSettings` so an absent or malformed blob degrades to the
 * defaults instead of taking the calendar down.
 */
export const clinicScheduleSettingsSchema = z.object({
  /** IANA zone the clinic's opening hours are expressed in. */
  timezone: z.string().min(1).default('Asia/Damascus'),
  /** Dates the clinic is shut regardless of the weekly schedule. */
  holidays: z.array(z.iso.date()).default([]),
});
export type ClinicScheduleSettings = z.infer<typeof clinicScheduleSettingsSchema>;

/** Never throws: unreadable settings must not stop the calendar from loading. */
export function clinicScheduleSettings(settings: unknown): ClinicScheduleSettings {
  const parsed = clinicScheduleSettingsSchema.safeParse(settings ?? {});

  return parsed.success ? parsed.data : { timezone: 'Asia/Damascus', holidays: [] };
}

/**
 * How the clinic's printed documents are produced, in `clinics.settings.documents`.
 *
 * The language here is the *clinic's*, not the reader's: a receipt is a
 * document of the practice, filed and handed to patients, and it should not
 * change language because a locum had the interface switched to English for
 * the afternoon. Same lenient parse as the other settings blocks.
 */
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

/* -------------------------------------------------------------------------- */
/* The clinic's logo                                                          */
/* -------------------------------------------------------------------------- */

/**
 * 2 MB, which is a generous letterhead logo and a poor place to keep a scan.
 *
 * Small on purpose: this image is fetched on every page load and drawn into
 * every PDF the clinic prints, so the cost of a careless 12-megapixel upload
 * is paid over and over rather than once.
 */
export const MAX_CLINIC_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Images only, and only the three every browser and pdf-lib both read.
 *
 * No SVG: it is a document that can carry script, and this one is rendered
 * inside the app's own origin. No TIFF or PDF either — a logo is displayed,
 * not archived.
 */
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
  /** Opaque to the client; it is echoed back on confirm. */
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

/**
 * The clinic's name and mark, before anybody has signed in.
 *
 * What the login screen needs and nothing else: no phone, no address, no
 * indication of how many clinics this deployment serves. `name` is null when
 * the answer is not a single clinic, and the screen then shows the product's
 * own mark — the same fallback it shows for a clinic that never uploaded one.
 */
export const clinicBrandingSchema = z.object({
  name: z.string().nullable(),
  logoUrl: z.url().nullable(),
});
export type ClinicBranding = z.infer<typeof clinicBrandingSchema>;

export const clinicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** R2 object key — never a public URL (CLAUDE.md files & images). */
  logoKey: z.string().nullable(),
  /** Short-lived signed URL for `logoKey`, minted per response. */
  logoUrl: z.url().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  /**
   * ISO-4217 code. Money itself is `numeric(10,2)`, handled as strings.
   *
   * Read as a plain string, not as the enum: a clinic row stored before the
   * list existed must still parse, or the settings screen it would be fixed on
   * is the one screen that fails to load.
   */
  currency: z.string(),
  workingHours: weeklyScheduleSchema,
  settings: settingsSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Clinic = z.infer<typeof clinicSchema>;

export const updateClinicSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
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
