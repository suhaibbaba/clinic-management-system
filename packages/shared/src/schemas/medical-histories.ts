import { z } from 'zod';

const entryListSchema = z.array(z.string().trim().min(1).max(160)).max(50);

/** Admin and doctor only; a technician gets the allergy flags below and nothing else (ROLES.md). */
export const medicalHistorySchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid(),
  chronicConditions: entryListSchema,
  allergies: entryListSchema,
  currentMedications: entryListSchema,
  isPregnant: z.boolean().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MedicalHistory = z.infer<typeof medicalHistorySchema>;

// ROLES.md allows a technician the allergy flag for safety and nothing else — no conditions,
// medications, notes or pregnancy status.
export const allergyFlagsSchema = z.object({
  patientId: z.uuid(),
  hasAllergies: z.boolean(),
  allergies: entryListSchema,
});
export type AllergyFlags = z.infer<typeof allergyFlagsSchema>;

export const updateMedicalHistorySchema = z
  .object({
    chronicConditions: entryListSchema,
    allergies: entryListSchema,
    currentMedications: entryListSchema,
    isPregnant: z.boolean().nullish(),
    notes: z.string().trim().max(2000).nullish(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateMedicalHistoryInput = z.infer<typeof updateMedicalHistorySchema>;
