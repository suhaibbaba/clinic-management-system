import { z } from "zod";

export const TRANSLATION_LANGUAGES = ["ar", "en"] as const;
export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

// The dotted path into the locale files, e.g. `labs.orders.title`. Bounded and restricted so a key
// can only ever address a string the app ships, never a prototype chain.
export const translationKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)*$/, "Not a translation key")
  .refine(
    (key) => !key.split(".").some((part) => part === "__proto__" || part === "constructor"),
    "Not a translation key",
  );

export const translationValueSchema = z.string().min(1).max(2000);

// Only what a clinic changed: the locale files stay the default, so wording improved in a deploy
// still reaches every clinic that never touched that key, and resetting one is deleting a row.
export const translationOverrideSchema = z.object({
  language: z.enum(TRANSLATION_LANGUAGES),
  key: translationKeySchema,
  value: translationValueSchema,
  updatedAt: z.iso.datetime(),
});
export type TranslationOverride = z.infer<typeof translationOverrideSchema>;

export const upsertTranslationOverrideSchema = z.object({
  language: z.enum(TRANSLATION_LANGUAGES),
  key: translationKeySchema,
  value: translationValueSchema,
});
export type UpsertTranslationOverrideInput = z.infer<typeof upsertTranslationOverrideSchema>;

// An emptied field is a reset, so the batch takes a value that may be blank where a single write
// may not: clearing the box is how the shipped wording comes back.
export const saveTranslationItemSchema = z.object({
  language: z.enum(TRANSLATION_LANGUAGES),
  key: translationKeySchema,
  value: z.string().max(2000),
});

/** A page of grouped wording: 25 texts, each written to every key that shares it, in two languages. */
export const TRANSLATION_BATCH_MAX = 500;

// One save for a screenful of edits: a footer that says "save" should be one request, and a page
// half-written is worse than one refused.
export const saveTranslationOverridesSchema = z.object({
  items: z.array(saveTranslationItemSchema).min(1).max(TRANSLATION_BATCH_MAX),
});
export type SaveTranslationOverridesInput = z.infer<typeof saveTranslationOverridesSchema>;

export const deleteTranslationOverrideSchema = z.object({
  language: z.enum(TRANSLATION_LANGUAGES),
  key: translationKeySchema,
});
export type DeleteTranslationOverrideInput = z.infer<typeof deleteTranslationOverrideSchema>;

// One response for both languages, nested the way i18next takes a resource bundle, so the client
// merges it over the bundled defaults without walking it first.
export const translationBundleSchema = z.object({
  ar: z.record(z.string(), z.unknown()),
  en: z.record(z.string(), z.unknown()),
});
export type TranslationBundle = z.infer<typeof translationBundleSchema>;

export const listTranslationOverridesSchema = z.object({
  items: z.array(translationOverrideSchema),
});
export type TranslationOverrideList = z.infer<typeof listTranslationOverridesSchema>;
