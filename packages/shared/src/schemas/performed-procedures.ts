import { z } from 'zod';

import { PERFORMED_PROCEDURE_STATUSES } from '@shared/enums';
import { createChartMarkSchema, chartMarkSchema } from '@shared/schemas/chart-marks';
import { paginationQuerySchema } from '@shared/schemas/common';
import { moneySchema } from '@shared/schemas/money';

/**
 * A procedure carried out on a patient.
 *
 * `price` is a snapshot of the catalog price at the time, so a later catalog
 * change never rewrites history. The billing charge is derived from this row.
 */
export const performedProcedureSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid(),
  visitId: z.uuid().nullable(),
  doctorId: z.uuid(),
  procedureId: z.uuid(),
  price: moneySchema,
  discount: moneySchema,
  discountReason: z.string().nullable(),
  status: z.enum(PERFORMED_PROCEDURE_STATUSES),
  planItemId: z.uuid().nullable(),
  performedAt: z.iso.datetime(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  chartMarks: z.array(chartMarkSchema).optional(),
});
export type PerformedProcedure = z.infer<typeof performedProcedureSchema>;

const procedureWritableFields = {
  visitId: z.uuid().nullish(),
  doctorId: z.uuid(),
  procedureId: z.uuid(),
  /** Omitted on create, the catalog's current price is snapshotted instead. */
  price: moneySchema,
  discount: moneySchema,
  discountReason: z.string().trim().max(500).nullish(),
  status: z.enum(PERFORMED_PROCEDURE_STATUSES),
  performedAt: z.iso.datetime(),
  notes: z.string().trim().max(2000).nullish(),
};

export const createPerformedProcedureSchema = z
  .object({
    ...procedureWritableFields,
    patientId: z.uuid(),
    price: moneySchema.optional(),
    discount: moneySchema.default('0.00'),
    status: z.enum(PERFORMED_PROCEDURE_STATUSES).default('done'),
    performedAt: z.iso.datetime().optional(),
    /** Chart marks are created with the procedure; they never exist alone. */
    chartMarks: z.array(createChartMarkSchema).max(32).default([]),
  })
  .refine(
    (input) =>
      input.discount === undefined ||
      input.discountReason !== undefined ||
      input.discount === '0.00',
    { message: 'A discount requires a reason', path: ['discountReason'] },
  );
export type CreatePerformedProcedureInput = z.infer<typeof createPerformedProcedureSchema>;

export const updatePerformedProcedureSchema = z
  .object(procedureWritableFields)
  .partial()
  .extend({ chartMarks: z.array(createChartMarkSchema).max(32).optional() })
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided')
  .refine(
    (input) =>
      input.discount === undefined || input.discount === '0.00' || Boolean(input.discountReason),
    { message: 'A discount requires a reason', path: ['discountReason'] },
  );
export type UpdatePerformedProcedureInput = z.infer<typeof updatePerformedProcedureSchema>;

export const listPerformedProceduresQuerySchema = paginationQuerySchema.extend({
  patientId: z.uuid().optional(),
  visitId: z.uuid().optional(),
  status: z.enum(PERFORMED_PROCEDURE_STATUSES).optional(),
});
export type ListPerformedProceduresQuery = z.infer<typeof listPerformedProceduresQuerySchema>;
