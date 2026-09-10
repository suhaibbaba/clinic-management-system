import { z } from 'zod';

import { isFdiTooth } from '@shared/constants/dental';
import { attachmentSchema } from '@shared/schemas/attachments';
import { uuidSchema } from '@shared/schemas/common';
import { chartMarkSchema } from '@shared/schemas/chart-marks';
import { performedProcedureSchema } from '@shared/schemas/performed-procedures';

// An aggregation over rows the other endpoints already return, so it exposes nothing new; a
// receptionist reaches none of it.
export const toothHistorySchema = z.object({
  patientId: z.uuid(),
  tooth: z.number().int().refine(isFdiTooth, 'Not a valid FDI tooth number'),
  /** Each procedure carries only the marks that touch this tooth. */
  procedures: z.array(performedProcedureSchema),
  marks: z.array(chartMarkSchema),
  attachments: z.array(attachmentSchema),
});
export type ToothHistory = z.infer<typeof toothHistorySchema>;

export const patientToothParamSchema = z.object({
  patientId: uuidSchema,
  fdi: z.coerce.number().int().refine(isFdiTooth, 'Not a valid FDI tooth number'),
});
export type PatientToothParam = z.infer<typeof patientToothParamSchema>;
