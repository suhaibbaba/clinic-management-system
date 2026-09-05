import { z } from 'zod';

import { CHART_TYPES } from '@shared/enums';
import { paginationQuerySchema } from '@shared/schemas/common';

/**
 * A clinic's specialty. `code` is free text validated against the known
 * `SPECIALTY_CODE` values in the UI — the database keeps it as text so adding a
 * specialty is data, not a migration (CLAUDE.md architecture decision 1).
 *
 * Specialty write endpoints land with the rest of the core module; this schema
 * exists because doctors embed their specialty.
 */
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

/** Trimmed form embedded in other entities. */
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
