import { z } from 'zod';

import { LOOKUP_LIST_KEYS } from '@shared/constants/lookups';
import { uuidSchema } from '@shared/schemas/common';

/**
 * One row of one editable list.
 *
 * `code` is the value stored in every column that refers to this row — an
 * appointment's type, an item's unit, a tooth's charted state — so it is
 * chosen once and never changed. The names are what people read and are freely
 * editable in both languages; `color` only means anything on a list that is
 * painted (today, the tooth chart).
 *
 * `isSystem` marks a row the application itself depends on: the chart's
 * `missing` and `implant` are drawn by special code, `cash` is what the seeded
 * data uses. Those rows keep editable names and colours — a clinic may prefer
 * "خالص" to "نقداً" — but cannot be removed or switched off, because something
 * already points at them.
 */
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

/**
 * A code is an identifier, not a label: lower-case letters, digits, dash, dot
 * and underscore. It appears in URLs, in JSON and in a `where` clause, and a
 * code with a space in it is a bug waiting for the day somebody filters by it.
 */
export const lookupCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    'A code may contain letters, digits, dot, dash and underscore',
  );

const colourSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a colour like #1f6feb');

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

/**
 * What may be edited, and what may not.
 *
 * `code` and `listKey` are absent on purpose: both are what other rows point
 * at, and changing either would orphan them silently. A miscoded row is
 * deactivated and replaced.
 */
export const updateLookupOptionSchema = z
  .object({
    nameAr: z.string().trim().min(1).max(160),
    nameEn: z.string().trim().min(1).max(160),
    color: colourSchema.nullish(),
    isActive: z.boolean(),
    meta: z.record(z.string(), z.unknown()),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
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

/**
 * Every list in one response, keyed by list.
 *
 * The client caches this whole shape rather than fetching per dropdown: it is
 * a few kilobytes, it is read by nearly every screen, and one request that is
 * invalidated as a unit cannot leave two dropdowns disagreeing about the same
 * list.
 */
export const lookupBundleSchema = z.record(z.string(), z.array(lookupOptionSchema));
export type LookupBundle = z.infer<typeof lookupBundleSchema>;

/** The label for a row in the language on screen, falling back to Arabic. */
export function lookupLabel(option: { nameAr: string; nameEn: string }, language: string): string {
  return language.startsWith('en') ? option.nameEn || option.nameAr : option.nameAr;
}
