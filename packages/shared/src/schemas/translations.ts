import { z } from "zod";

export const TRANSLATION_LANGUAGES = ["ar", "en"] as const;
export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

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

export const saveTranslationItemSchema = z.object({
  language: z.enum(TRANSLATION_LANGUAGES),
  key: translationKeySchema,
  value: z.string().max(2000),
});

export const TRANSLATION_BATCH_MAX = 500;

export const saveTranslationOverridesSchema = z.object({
  items: z.array(saveTranslationItemSchema).min(1).max(TRANSLATION_BATCH_MAX),
});
export type SaveTranslationOverridesInput = z.infer<typeof saveTranslationOverridesSchema>;

export const deleteTranslationOverrideSchema = z.object({
  language: z.enum(TRANSLATION_LANGUAGES),
  key: translationKeySchema,
});
export type DeleteTranslationOverrideInput = z.infer<typeof deleteTranslationOverrideSchema>;

export const translationBundleSchema = z.object({
  ar: z.record(z.string(), z.unknown()),
  en: z.record(z.string(), z.unknown()),
});
export type TranslationBundle = z.infer<typeof translationBundleSchema>;

export const listTranslationOverridesSchema = z.object({
  items: z.array(translationOverrideSchema),
});
export type TranslationOverrideList = z.infer<typeof listTranslationOverridesSchema>;
