import { z } from 'zod';

import { TREATMENT_PLAN_ITEM_STATUSES, TREATMENT_PLAN_STATUSES } from '@shared/enums';
import { paginationQuerySchema } from '@shared/schemas/common';
import { moneySchema } from '@shared/schemas/money';

export const treatmentPlanItemSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  treatmentPlanId: z.uuid(),
  procedureId: z.uuid(),
  estimatedPrice: moneySchema,
  sortOrder: z.number().int().min(0),
  status: z.enum(TREATMENT_PLAN_ITEM_STATUSES),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TreatmentPlanItem = z.infer<typeof treatmentPlanItemSchema>;

export const treatmentPlanSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid(),
  doctorId: z.uuid(),
  title: z.string(),
  status: z.enum(TREATMENT_PLAN_STATUSES),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  items: z.array(treatmentPlanItemSchema).optional(),
});
export type TreatmentPlan = z.infer<typeof treatmentPlanSchema>;

const planItemWritableFields = {
  procedureId: z.uuid(),
  estimatedPrice: moneySchema,
  sortOrder: z.number().int().min(0).max(999),
  notes: z.string().trim().max(1000).nullish(),
};

export const createTreatmentPlanItemSchema = z.object({
  ...planItemWritableFields,
  /** Falls back to the catalog price when omitted. */
  estimatedPrice: moneySchema.optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type CreateTreatmentPlanItemInput = z.infer<typeof createTreatmentPlanItemSchema>;

export const updateTreatmentPlanItemSchema = z
  .object({ ...planItemWritableFields, status: z.enum(TREATMENT_PLAN_ITEM_STATUSES) })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateTreatmentPlanItemInput = z.infer<typeof updateTreatmentPlanItemSchema>;

const planWritableFields = {
  doctorId: z.uuid(),
  title: z.string().trim().min(2).max(160),
  status: z.enum(TREATMENT_PLAN_STATUSES),
  notes: z.string().trim().max(2000).nullish(),
};

export const createTreatmentPlanSchema = z.object({
  ...planWritableFields,
  patientId: z.uuid(),
  status: z.enum(TREATMENT_PLAN_STATUSES).default('draft'),
  items: z.array(createTreatmentPlanItemSchema).max(64).default([]),
});
export type CreateTreatmentPlanInput = z.infer<typeof createTreatmentPlanSchema>;

export const updateTreatmentPlanSchema = z
  .object(planWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateTreatmentPlanInput = z.infer<typeof updateTreatmentPlanSchema>;

/** Body of `POST /plan-items/:id/convert`. */
export const convertPlanItemSchema = z.object({
  visitId: z.uuid().nullish(),
  doctorId: z.uuid().optional(),
  /** Defaults to the item's estimated price. */
  price: moneySchema.optional(),
  performedAt: z.iso.datetime().optional(),
});
export type ConvertPlanItemInput = z.infer<typeof convertPlanItemSchema>;

export const listTreatmentPlansQuerySchema = paginationQuerySchema.extend({
  patientId: z.uuid().optional(),
  status: z.enum(TREATMENT_PLAN_STATUSES).optional(),
});
export type ListTreatmentPlansQuery = z.infer<typeof listTreatmentPlansQuerySchema>;
