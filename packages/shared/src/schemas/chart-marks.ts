import { z } from 'zod';

import { CHART_TYPE } from '@shared/enums';
import { isFdiTooth, TOOTH_SURFACES } from '@shared/constants/dental';

/**
 * Where on the body a procedure was performed.
 *
 * The shape is chosen by the specialty's `chart_type`, so a new specialty adds
 * a location shape rather than a code branch anywhere else
 * (CLAUDE.md architecture decisions 1 and 5).
 */
export const toothLocationSchema = z.object({
  /** FDI number: 11–48 permanent, 51–85 deciduous. */
  tooth: z.number().int().refine(isFdiTooth, 'Not a valid FDI tooth number'),
  surfaces: z.array(z.enum(TOOTH_SURFACES)).max(TOOTH_SURFACES.length).default([]),
});
export type ToothLocation = z.infer<typeof toothLocationSchema>;

export const bodyRegionLocationSchema = z.object({
  region: z.string().trim().min(1).max(64),
  side: z.enum(['left', 'right', 'midline']).optional(),
});
export type BodyRegionLocation = z.infer<typeof bodyRegionLocationSchema>;

/** Discriminated so an FDI tooth can never be stored against a skeleton chart. */
export const chartMarkLocationSchema = z.discriminatedUnion('chartType', [
  z.object({ chartType: z.literal(CHART_TYPE.TOOTH_FDI), location: toothLocationSchema }),
  z.object({ chartType: z.literal(CHART_TYPE.BODY_REGION), location: bodyRegionLocationSchema }),
]);
export type ChartMarkLocation = z.infer<typeof chartMarkLocationSchema>;

export const chartMarkSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  performedProcedureId: z.uuid(),
  chartType: z.enum([CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION]),
  location: z.union([toothLocationSchema, bodyRegionLocationSchema]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ChartMark = z.infer<typeof chartMarkSchema>;

export const createChartMarkSchema = chartMarkLocationSchema;
export type CreateChartMarkInput = z.infer<typeof createChartMarkSchema>;

/** `:fdi` route parameter for the tooth-history endpoint. */
export const fdiParamSchema = z.object({
  fdi: z.coerce.number().int().refine(isFdiTooth, 'Not a valid FDI tooth number'),
});
export type FdiParam = z.infer<typeof fdiParamSchema>;
