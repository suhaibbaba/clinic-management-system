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

export const clinicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** R2 object key — never a public URL (CLAUDE.md files & images). */
  logoKey: z.string().nullable(),
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
    logoKey: z.string().trim().max(512).nullish(),
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
