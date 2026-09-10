import { z } from 'zod';

import { CHART_TYPES } from '@shared/enums';
import { paginationQuerySchema } from '@shared/schemas/common';

// `code` is text in the database, so giving a clinic a new specialty is data rather than a
// migration.
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
