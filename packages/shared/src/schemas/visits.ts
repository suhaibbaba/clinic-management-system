import { z } from 'zod';

import { paginationQuerySchema } from '@shared/schemas/common';

/** A clinical encounter. Admin and doctor only (ROLES.md). */
export const visitSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid(),
  doctorId: z.uuid(),
  visitDate: z.iso.datetime(),
  complaint: z.string().nullable(),
  examination: z.string().nullable(),
  diagnosis: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Visit = z.infer<typeof visitSchema>;

const visitWritableFields = {
  doctorId: z.uuid(),
  visitDate: z.iso.datetime(),
  complaint: z.string().trim().max(2000).nullish(),
  examination: z.string().trim().max(4000).nullish(),
  diagnosis: z.string().trim().max(2000).nullish(),
  notes: z.string().trim().max(4000).nullish(),
};

export const createVisitSchema = z.object({
  ...visitWritableFields,
  patientId: z.uuid(),
  /** Defaults to now: a visit is usually recorded as it happens. */
  visitDate: z.iso.datetime().optional(),
});
export type CreateVisitInput = z.infer<typeof createVisitSchema>;

export const updateVisitSchema = z
  .object(visitWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;

export const listVisitsQuerySchema = paginationQuerySchema.extend({
  patientId: z.uuid().optional(),
  doctorId: z.uuid().optional(),
});
export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;
