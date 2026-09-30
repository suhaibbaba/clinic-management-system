import { z } from "zod";
import { TREATMENT_PLAN_STATUSES } from "@shared/enums";
import { paginationQuerySchema } from "@shared/schemas/common";
import { moneySchema } from "@shared/schemas/money";

export const treatmentPlanSummarySchema = z.object({
  total: moneySchema,
  done: moneySchema,
  remaining: moneySchema,
  treatments: z.number().int().min(0),
  completed: z.number().int().min(0),
});
export type TreatmentPlanSummary = z.infer<typeof treatmentPlanSummarySchema>;

export const treatmentPlanSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid(),
  doctorId: z.uuid(),
  title: z.string(),
  status: z.enum(TREATMENT_PLAN_STATUSES),
  notes: z.string().nullable(),
  summary: treatmentPlanSummarySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TreatmentPlan = z.infer<typeof treatmentPlanSchema>;

const planWritableFields = {
  doctorId: z.uuid(),
  title: z.string().trim().min(2).max(160),
  status: z.enum(TREATMENT_PLAN_STATUSES),
  notes: z.string().trim().max(2000).nullish(),
};

export const createTreatmentPlanSchema = z.object({
  ...planWritableFields,
  patientId: z.uuid(),
  status: z.enum(TREATMENT_PLAN_STATUSES).default("draft"),
});
export type CreateTreatmentPlanInput = z.infer<typeof createTreatmentPlanSchema>;

export const updateTreatmentPlanSchema = z
  .object(planWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateTreatmentPlanInput = z.infer<typeof updateTreatmentPlanSchema>;

export const listTreatmentPlansQuerySchema = paginationQuerySchema.extend({
  patientId: z.uuid().optional(),
  status: z.enum(TREATMENT_PLAN_STATUSES).optional(),
});
export type ListTreatmentPlansQuery = z.infer<typeof listTreatmentPlansQuerySchema>;
