import { z } from 'zod';

import { settingsSchema, weeklyScheduleSchema } from '@shared/schemas/common';

export const clinicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** R2 object key — never a public URL (CLAUDE.md files & images). */
  logoKey: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  /** ISO-4217 code. Money itself is `numeric(10,2)`, handled as strings. */
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
    currency: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Z]{3}$/, 'Expected a three-letter ISO-4217 code'),
    workingHours: weeklyScheduleSchema,
    settings: settingsSchema,
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
