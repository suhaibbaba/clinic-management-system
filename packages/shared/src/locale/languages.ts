import { z } from "zod";

export type TextDirection = "rtl" | "ltr";

export type Script = "arabic" | "latin";

export interface LanguageDefinition {
  readonly code: string;
  readonly dir: TextDirection;
  readonly nativeName: string;
  readonly intlLocale: string;
  readonly script: Script;
}

export const LANGUAGE_DEFINITIONS = [
  { code: "ar", dir: "rtl", nativeName: "العربية", intlLocale: "ar-SY", script: "arabic" },
  { code: "en", dir: "ltr", nativeName: "English", intlLocale: "en-GB", script: "latin" },
  { code: "tr", dir: "ltr", nativeName: "Türkçe", intlLocale: "tr-TR", script: "latin" },
] as const satisfies readonly LanguageDefinition[];

export type LanguageCode = (typeof LANGUAGE_DEFINITIONS)[number]["code"];

export const LANGUAGE_CODES = LANGUAGE_DEFINITIONS.map((language) => language.code) as [
  LanguageCode,
  ...LanguageCode[],
];

export const DEFAULT_LANGUAGE: LanguageCode = "ar";

export const FALLBACK_LANGUAGE: LanguageCode = "en";

export const languageCodeSchema = z.enum(LANGUAGE_CODES);

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === "string" && (LANGUAGE_CODES as readonly string[]).includes(value);

export const baseLanguage = (tag: string): string => tag.split("-")[0]?.toLowerCase() ?? "";

export const toLanguageCode = (tag: string | null | undefined, fallback = DEFAULT_LANGUAGE) => {
  const base = baseLanguage(tag ?? "");

  return isLanguageCode(base) ? base : fallback;
};

export function languageDefinition(code: string): LanguageDefinition {
  const base = baseLanguage(code);

  return (
    LANGUAGE_DEFINITIONS.find((language) => language.code === base) ??
    LANGUAGE_DEFINITIONS.find((language) => language.code === FALLBACK_LANGUAGE)!
  );
}

export const languageDirection = (code: string): TextDirection => languageDefinition(code).dir;

export const isRtlLanguage = (code: string): boolean => languageDirection(code) === "rtl";

export const languageScript = (code: string): Script => languageDefinition(code).script;
