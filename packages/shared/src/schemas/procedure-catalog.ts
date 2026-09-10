import { z } from 'zod';

import { moneySchema, wholeMoneySchema } from '@shared/schemas/money';
import { paginationQuerySchema } from '@shared/schemas/common';
import { lookupCodeSchema } from '@shared/schemas/lookups';

export const procedureCatalogItemSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  specialtyId: z.uuid(),
  code: z.string(),
  nameAr: z.string(),
  nameEn: z.string(),
  defaultPrice: moneySchema,
  /** Null for procedures that chart nothing — an examination, a cleaning, an X-ray. */
  chartOutcome: lookupCodeSchema.nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProcedureCatalogItem = z.infer<typeof procedureCatalogItemSchema>;

/** What a receptionist may read: names and prices only (ROLES.md core matrix). */
export const procedureCatalogPriceViewSchema = procedureCatalogItemSchema.pick({
  id: true,
  code: true,
  nameAr: true,
  nameEn: true,
  defaultPrice: true,
});
export type ProcedureCatalogPriceView = z.infer<typeof procedureCatalogPriceViewSchema>;

const catalogWritableFields = {
  specialtyId: z.uuid(),
  code: z.string().trim().min(1).max(32),
  nameAr: z.string().trim().min(1).max(160),
  nameEn: z.string().trim().min(1).max(160),
  defaultPrice: wholeMoneySchema,
  chartOutcome: lookupCodeSchema.nullish(),
  isActive: z.boolean(),
};

export const createProcedureCatalogItemSchema = z.object({
  ...catalogWritableFields,
  isActive: z.boolean().default(true),
});
export type CreateProcedureCatalogItemInput = z.infer<typeof createProcedureCatalogItemSchema>;

export const updateProcedureCatalogItemSchema = z
  .object(catalogWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateProcedureCatalogItemInput = z.infer<typeof updateProcedureCatalogItemSchema>;

export const listProcedureCatalogQuerySchema = paginationQuerySchema.extend({
  specialtyId: z.uuid().optional(),
  isActive: z.stringbool().optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
export type ListProcedureCatalogQuery = z.infer<typeof listProcedureCatalogQuerySchema>;
