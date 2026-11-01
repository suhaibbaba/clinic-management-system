import { z } from "zod";
import {
  ENGLISH_ONLY_LOOKUP_LISTS,
  LOOKUP_LIST_KEYS,
  type LookupListKey,
} from "@shared/constants/lookups";
import { uuidSchema } from "@shared/schemas/common";
import { FALLBACK_LANGUAGE } from "@shared/locale/languages";
import {
  localized,
  localizedTextInputSchema,
  localizedTextSchema,
  type LocalizedText,
} from "@shared/locale/localized-text";

export const lookupOptionSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  listKey: z.enum(LOOKUP_LIST_KEYS),
  code: z.string(),
  name: localizedTextSchema,
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  meta: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type LookupOption = z.infer<typeof lookupOptionSchema>;

export const lookupCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    "A code may contain letters, digits, dot, dash and underscore",
  );

const colourSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a colour like #1f6feb");

export const createLookupOptionSchema = z.object({
  listKey: z.enum(LOOKUP_LIST_KEYS),
  code: lookupCodeSchema.optional(),
  name: localizedTextInputSchema(1, 160),
  color: colourSchema.nullish(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type CreateLookupOptionInput = z.infer<typeof createLookupOptionSchema>;

export const updateLookupOptionSchema = z
  .object({
    name: localizedTextInputSchema(1, 160),
    color: colourSchema.nullish(),
    isActive: z.boolean(),
    meta: z.record(z.string(), z.unknown()),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateLookupOptionInput = z.infer<typeof updateLookupOptionSchema>;

export const reorderLookupOptionsSchema = z.object({
  listKey: z.enum(LOOKUP_LIST_KEYS),
  ids: z.array(uuidSchema).min(1).max(200),
});
export type ReorderLookupOptionsInput = z.infer<typeof reorderLookupOptionsSchema>;

export const setLookupOptionsActiveSchema = z.object({
  listKey: z.enum(LOOKUP_LIST_KEYS),
  ids: z.array(uuidSchema).min(1).max(500),
  isActive: z.boolean(),
});
export type SetLookupOptionsActiveInput = z.infer<typeof setLookupOptionsActiveSchema>;

export const listLookupOptionsQuerySchema = z.object({
  listKey: z.enum(LOOKUP_LIST_KEYS).optional(),
  includeInactive: z.coerce.boolean().optional(),
});
export type ListLookupOptionsQuery = z.infer<typeof listLookupOptionsQuerySchema>;

export const lookupBundleSchema = z.record(z.string(), z.array(lookupOptionSchema));
export type LookupBundle = z.infer<typeof lookupBundleSchema>;

export function lookupLabel(
  option: { readonly listKey?: LookupListKey; readonly name: LocalizedText },
  language: string,
  fallbacks: readonly string[] = [],
): string {
  const englishOnly =
    option.listKey !== undefined && ENGLISH_ONLY_LOOKUP_LISTS.includes(option.listKey);

  return localized(option.name, englishOnly ? FALLBACK_LANGUAGE : language, fallbacks);
}
