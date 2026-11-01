import type { Currency } from "@shared/locale/currencies";
import type { LanguageCode } from "@shared/locale/languages";

export type ClockFormat = "12h" | "24h";

export const CLOCK_FORMATS = ["12h", "24h"] as const satisfies readonly ClockFormat[];

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface CountryPreset {
  readonly languages: readonly [LanguageCode, ...LanguageCode[]];
  readonly currency: Currency;
  readonly timeZone: string;
  readonly clock: ClockFormat;
  readonly weekStart: Weekday;
}

const ARAB = { languages: ["ar", "en"], clock: "12h", weekStart: 6 } as const;

export const COUNTRY_PRESETS = {
  PS: { ...ARAB, currency: "ILS", timeZone: "Asia/Hebron" },
  IL: { ...ARAB, currency: "ILS", timeZone: "Asia/Jerusalem", weekStart: 0 },
  JO: { ...ARAB, currency: "JOD", timeZone: "Asia/Amman" },
  EG: { ...ARAB, currency: "EGP", timeZone: "Africa/Cairo" },
  SA: { ...ARAB, currency: "SAR", timeZone: "Asia/Riyadh", weekStart: 0 },
  AE: { ...ARAB, currency: "AED", timeZone: "Asia/Dubai", weekStart: 1 },
  QA: { ...ARAB, currency: "QAR", timeZone: "Asia/Qatar", weekStart: 0 },
  KW: { ...ARAB, currency: "KWD", timeZone: "Asia/Kuwait", weekStart: 0 },
  BH: { ...ARAB, currency: "BHD", timeZone: "Asia/Bahrain", weekStart: 0 },
  OM: { ...ARAB, currency: "OMR", timeZone: "Asia/Muscat", weekStart: 0 },
  LB: { ...ARAB, currency: "USD", timeZone: "Asia/Beirut", weekStart: 1 },
  SY: { ...ARAB, currency: "SYP", timeZone: "Asia/Damascus" },
  IQ: { ...ARAB, currency: "IQD", timeZone: "Asia/Baghdad" },
  TR: {
    languages: ["tr", "en"],
    currency: "TRY",
    timeZone: "Europe/Istanbul",
    clock: "24h",
    weekStart: 1,
  },
  GB: {
    languages: ["en"],
    currency: "GBP",
    timeZone: "Europe/London",
    clock: "24h",
    weekStart: 1,
  },
  DE: {
    languages: ["en"],
    currency: "EUR",
    timeZone: "Europe/Berlin",
    clock: "24h",
    weekStart: 1,
  },
  US: {
    languages: ["en"],
    currency: "USD",
    timeZone: "America/New_York",
    clock: "12h",
    weekStart: 0,
  },
} as const satisfies Record<string, CountryPreset>;

export type PresetCountry = keyof typeof COUNTRY_PRESETS;

export const DEFAULT_COUNTRY: PresetCountry = "PS";

export function countryPreset(country: string | null | undefined): CountryPreset {
  const presets: Record<string, CountryPreset> = COUNTRY_PRESETS;

  return presets[(country ?? "").toUpperCase()] ?? COUNTRY_PRESETS[DEFAULT_COUNTRY];
}
