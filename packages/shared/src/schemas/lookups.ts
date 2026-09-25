import { z } from "zod";
import {
  ENGLISH_ONLY_LOOKUP_LISTS,
  LOOKUP_LIST_KEYS,
  type LookupListKey,
} from "@shared/constants/lookups";
import { uuidSchema } from "@shared/schemas/common";

export const lookupOptionSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  listKey: z.enum(LOOKUP_LIST_KEYS),
  code: z.string(),
  nameAr: z.string(),
  nameEn: z.string(),
  /** `#rrggbb`, or null to use the built-in styling. */
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
  /** Omitted, a code is derived from the English name — which is what a person
   *  typing "Night guard" expects to happen. */
  code: lookupCodeSchema.optional(),
  nameAr: z.string().trim().min(1).max(160),
  nameEn: z.string().trim().min(1).max(160),
  color: colourSchema.nullish(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type CreateLookupOptionInput = z.infer<typeof createLookupOptionSchema>;

// `code` and `listKey` are absent on purpose — other rows point at them, and changing either would
// orphan them silently.
export const updateLookupOptionSchema = z
  .object({
    nameAr: z.string().trim().min(1).max(160),
    nameEn: z.string().trim().min(1).max(160),
    color: colourSchema.nullish(),
    isActive: z.boolean(),
    meta: z.record(z.string(), z.unknown()),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateLookupOptionInput = z.infer<typeof updateLookupOptionSchema>;

/** Drag-and-drop sends the whole list back in its new order. */
export const reorderLookupOptionsSchema = z.object({
  listKey: z.enum(LOOKUP_LIST_KEYS),
  ids: z.array(uuidSchema).min(1).max(200),
});
export type ReorderLookupOptionsInput = z.infer<typeof reorderLookupOptionsSchema>;

export const listLookupOptionsQuerySchema = z.object({
  listKey: z.enum(LOOKUP_LIST_KEYS).optional(),
  /** The admin screen needs the switched-off rows; a dropdown never does. */
  includeInactive: z.coerce.boolean().optional(),
});
export type ListLookupOptionsQuery = z.infer<typeof listLookupOptionsQuerySchema>;

// Every list in one cached response: a few kilobytes read by nearly every screen, invalidated as a
// unit so two dropdowns cannot disagree.
export const lookupBundleSchema = z.record(z.string(), z.array(lookupOptionSchema));
export type LookupBundle = z.infer<typeof lookupBundleSchema>;

/** The label for a row in the language on screen, falling back to Arabic. */
export function lookupLabel(
  option: { readonly listKey?: LookupListKey; readonly nameAr: string; readonly nameEn: string },
  language: string,
): string {
  const english =
    language.startsWith("en") ||
    (option.listKey !== undefined && ENGLISH_ONLY_LOOKUP_LISTS.includes(option.listKey));

  return english ? option.nameEn || option.nameAr : option.nameAr;
}
