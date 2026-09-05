import { z } from 'zod';

import { isFdiTooth } from '@shared/constants/dental';
import { attachmentSchema } from '@shared/schemas/attachments';
import { uuidSchema } from '@shared/schemas/common';
import { chartMarkSchema } from '@shared/schemas/chart-marks';
import { performedProcedureSchema } from '@shared/schemas/performed-procedures';

/**
 * Everything recorded against one tooth: `GET /patients/:id/teeth/:fdi`.
 *
 * It is an aggregation over the same rows the other endpoints return, so no
 * field appears here that a caller could not read elsewhere — and a
 * receptionist reaches none of it (ROLES.md patients matrix).
 */
export const toothHistorySchema = z.object({
  patientId: z.uuid(),
  tooth: z.number().int().refine(isFdiTooth, 'Not a valid FDI tooth number'),
  /** Each procedure carries only the marks that touch this tooth. */
  procedures: z.array(performedProcedureSchema),
  marks: z.array(chartMarkSchema),
  attachments: z.array(attachmentSchema),
});
export type ToothHistory = z.infer<typeof toothHistorySchema>;

/** `:patientId` + `:fdi` route parameters of the tooth-history route. */
export const patientToothParamSchema = z.object({
  patientId: uuidSchema,
  fdi: z.coerce.number().int().refine(isFdiTooth, 'Not a valid FDI tooth number'),
});
export type PatientToothParam = z.infer<typeof patientToothParamSchema>;
