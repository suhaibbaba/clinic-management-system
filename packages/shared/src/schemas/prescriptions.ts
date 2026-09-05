import { z } from 'zod';

import { paginationQuerySchema } from '@shared/schemas/common';

export const prescriptionItemSchema = z.object({
  drug: z.string().trim().min(1).max(160),
  dose: z.string().trim().min(1).max(80),
  frequency: z.string().trim().min(1).max(80),
  duration: z.string().trim().min(1).max(80),
  note: z.string().trim().max(300).nullish(),
});
export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;

/** Admin and doctor only; never included in a receptionist response. */
export const prescriptionSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid(),
  visitId: z.uuid().nullable(),
  doctorId: z.uuid(),
  items: z.array(prescriptionItemSchema),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Prescription = z.infer<typeof prescriptionSchema>;

const prescriptionWritableFields = {
  visitId: z.uuid().nullish(),
  doctorId: z.uuid(),
  items: z.array(prescriptionItemSchema).min(1).max(32),
  notes: z.string().trim().max(2000).nullish(),
};

export const createPrescriptionSchema = z.object({
  ...prescriptionWritableFields,
  patientId: z.uuid(),
});
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;

export const updatePrescriptionSchema = z
  .object(prescriptionWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;

export const listPrescriptionsQuerySchema = paginationQuerySchema.extend({
  patientId: z.uuid().optional(),
  visitId: z.uuid().optional(),
});
export type ListPrescriptionsQuery = z.infer<typeof listPrescriptionsQuerySchema>;
