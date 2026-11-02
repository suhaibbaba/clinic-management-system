import { z } from "zod";
import { paginationQuerySchema } from "@shared/schemas/common";
import { lookupCodeSchema } from "@shared/schemas/lookups";
import { wholeMoneySchema } from "@shared/schemas/money";

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

export const visitFeeSchema = z.object({
  procedureId: z.uuid(),
  price: wholeMoneySchema.optional(),
  paidWith: lookupCodeSchema.optional(),
});
export type VisitFeeInput = z.infer<typeof visitFeeSchema>;

export const createVisitSchema = z.object({
  ...visitWritableFields,
  patientId: z.uuid(),
  visitDate: z.iso.datetime().optional(),
  fee: visitFeeSchema.optional(),
});
export type CreateVisitInput = z.infer<typeof createVisitSchema>;

export const updateVisitSchema = z
  .object(visitWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;

export const listVisitsQuerySchema = paginationQuerySchema.extend({
  patientId: z.uuid().optional(),
  doctorId: z.uuid().optional(),
});
export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;
