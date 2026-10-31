import { z } from "zod";
import { CHART_TYPES } from "@shared/enums";
import { paginationQuerySchema } from "@shared/schemas/common";

export const specialtySchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  code: z.string(),
  name: z.string(),
  chartType: z.enum(CHART_TYPES),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Specialty = z.infer<typeof specialtySchema>;

export const specialtySummarySchema = specialtySchema.pick({
  id: true,
  code: true,
  name: true,
  chartType: true,
});
export type SpecialtySummary = z.infer<typeof specialtySummarySchema>;

export const listSpecialtiesQuerySchema = paginationQuerySchema.extend({
  isActive: z.stringbool().optional(),
});
export type ListSpecialtiesQuery = z.infer<typeof listSpecialtiesQuerySchema>;

export const createSpecialtySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(1).max(80),
  chartType: z.enum(CHART_TYPES),
  isActive: z.boolean().default(true),
});
export type CreateSpecialtyInput = z.infer<typeof createSpecialtySchema>;

export const updateSpecialtySchema = z
  .object({
    name: createSpecialtySchema.shape.name,
    isActive: z.boolean(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateSpecialtyInput = z.infer<typeof updateSpecialtySchema>;
