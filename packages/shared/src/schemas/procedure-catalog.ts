import { z } from "zod";
import { localizedTextInputSchema, localizedTextSchema } from "@shared/locale/localized-text";
import { moneySchema, wholeMoneySchema } from "@shared/schemas/money";
import { paginationQuerySchema } from "@shared/schemas/common";
import { lookupCodeSchema } from "@shared/schemas/lookups";

export const procedureCatalogItemSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  specialtyId: z.uuid(),
  code: z.string(),
  name: localizedTextSchema,
  defaultPrice: moneySchema,
  chartOutcome: lookupCodeSchema.nullable(),
  taxExempt: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProcedureCatalogItem = z.infer<typeof procedureCatalogItemSchema>;

export const procedureCatalogPriceViewSchema = procedureCatalogItemSchema
  .pick({
    id: true,
    code: true,
    name: true,
    defaultPrice: true,
  })
  .extend({ chartOutcome: procedureCatalogItemSchema.shape.chartOutcome.optional() });
export type ProcedureCatalogPriceView = z.infer<typeof procedureCatalogPriceViewSchema>;

const catalogWritableFields = {
  specialtyId: z.uuid(),
  code: z.string().trim().min(1).max(32),
  name: localizedTextInputSchema(1, 160),
  defaultPrice: wholeMoneySchema,
  chartOutcome: lookupCodeSchema.nullish(),
  taxExempt: z.boolean(),
  isActive: z.boolean(),
};

export const createProcedureCatalogItemSchema = z.object({
  ...catalogWritableFields,
  taxExempt: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type CreateProcedureCatalogItemInput = z.infer<typeof createProcedureCatalogItemSchema>;

export const updateProcedureCatalogItemSchema = z
  .object(catalogWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateProcedureCatalogItemInput = z.infer<typeof updateProcedureCatalogItemSchema>;

const catalogIdsSchema = z.array(z.uuid()).min(1).max(1000);

export const setProcedureCatalogItemsActiveSchema = z.object({
  ids: catalogIdsSchema,
  isActive: z.boolean(),
});
export type SetProcedureCatalogItemsActiveInput = z.infer<
  typeof setProcedureCatalogItemsActiveSchema
>;

export const removeProcedureCatalogItemsSchema = z.object({ ids: catalogIdsSchema });
export type RemoveProcedureCatalogItemsInput = z.infer<typeof removeProcedureCatalogItemsSchema>;

export const listProcedureCatalogQuerySchema = paginationQuerySchema.extend({
  specialtyId: z.uuid().optional(),
  isActive: z.stringbool().optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type ListProcedureCatalogQuery = z.infer<typeof listProcedureCatalogQuerySchema>;
