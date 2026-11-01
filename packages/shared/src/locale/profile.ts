import { z } from "zod";
import { CLOCK_FORMATS, countryPreset } from "@shared/locale/countries";
import {
  languageCodeSchema,
  languageDefinition,
  type LanguageCode,
} from "@shared/locale/languages";

export const clinicLocaleSettingsSchema = z
  .object({
    languages: z
      .array(languageCodeSchema)
      .min(1)
      .refine((list) => new Set(list).size === list.length, "Languages must not repeat"),
    clock: z.enum(CLOCK_FORMATS),
    weekStart: z.number().int().min(0).max(6),
  })
  .partial();
export type ClinicLocaleSettings = z.infer<typeof clinicLocaleSettingsSchema>;

export const clinicLocaleSchema = z.object({
  country: z.string(),
  currency: z.string(),
  timeZone: z.string(),
  languages: z.tuple([languageCodeSchema], languageCodeSchema),
  primaryLanguage: languageCodeSchema,
  clock: z.enum(CLOCK_FORMATS),
  weekStart: z.number().int().min(0).max(6),
  numberLocale: z.string(),
});

export type ClinicLocale = z.infer<typeof clinicLocaleSchema>;

export interface ClinicLocaleSource {
  readonly country?: string | null | undefined;
  readonly currency?: string | null | undefined;
  readonly settings?: unknown;
}

const section = (settings: unknown, key: string): unknown =>
  typeof settings === "object" && settings !== null
    ? (settings as Record<string, unknown>)[key]
    : undefined;

export function clinicLocaleSettings(settings: unknown): ClinicLocaleSettings {
  const parsed = clinicLocaleSettingsSchema.safeParse(section(settings, "locale") ?? {});

  return parsed.success ? parsed.data : {};
}

export const numberLocaleOf = (language: string, country: string): string =>
  `${languageDefinition(language).code}-${country.toUpperCase()}-u-nu-latn`;

export function clinicLocale(clinic: ClinicLocaleSource | null | undefined): ClinicLocale {
  const preset = countryPreset(clinic?.country);
  const country = (clinic?.country ?? "").toUpperCase() || "PS";
  const own = clinicLocaleSettings(clinic?.settings);
  const languages = (own.languages ?? preset.languages) as [LanguageCode, ...LanguageCode[]];
  const primaryLanguage = languages[0];
  const timeZone = section(clinic?.settings, "timezone");

  return {
    country,
    currency: clinic?.currency ?? preset.currency,
    timeZone: typeof timeZone === "string" && timeZone !== "" ? timeZone : preset.timeZone,
    languages,
    primaryLanguage,
    clock: own.clock ?? preset.clock,
    weekStart: own.weekStart ?? preset.weekStart,
    numberLocale: numberLocaleOf(primaryLanguage, country),
  };
}
