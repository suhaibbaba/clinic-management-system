import { z } from "zod";
import {
  FALLBACK_LANGUAGE,
  LANGUAGE_CODES,
  baseLanguage,
  languageCodeSchema,
  type LanguageCode,
} from "@shared/locale/languages";

export type LocalizedText = Partial<Record<LanguageCode, string>>;

export const localizedTextSchema = z.partialRecord(languageCodeSchema, z.string());

const hasAnyText = (text: LocalizedText): boolean =>
  Object.values(text).some((value) => typeof value === "string" && value.trim() !== "");

export const localizedTextInputSchema = (min: number, max: number) =>
  z
    .partialRecord(languageCodeSchema, z.string().trim().max(max))
    .refine(
      (text) =>
        Object.values(text).every(
          (value) => value === undefined || value === "" || value.length >= min,
        ),
      { message: `Each name must be at least ${min} characters` },
    )
    .refine(hasAnyText, { message: "At least one language is required" })
    .transform(
      (text) =>
        Object.fromEntries(
          Object.entries(text).filter(([, value]) => typeof value === "string" && value !== ""),
        ) as LocalizedText,
    );

export function localized(
  text: LocalizedText | null | undefined,
  language: string,
  fallbacks: readonly string[] = [],
): string {
  if (!text) {
    return "";
  }

  const order = [
    baseLanguage(language),
    ...fallbacks.map(baseLanguage),
    FALLBACK_LANGUAGE,
    ...LANGUAGE_CODES,
  ];

  for (const code of order) {
    const value = (text as Record<string, unknown>)[code];

    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return "";
}

export const localizedValues = (text: LocalizedText | null | undefined): string[] =>
  text
    ? [
        ...new Set(
          Object.values(text).filter((value): value is string => !!value && value.trim() !== ""),
        ),
      ]
    : [];

export const sameText = (text: string): LocalizedText =>
  Object.fromEntries(LANGUAGE_CODES.map((code) => [code, text])) as LocalizedText;
