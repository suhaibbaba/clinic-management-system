import type { PhoneCountry, SiteLanguage } from "@clinic/shared";

export const SITE_LANGUAGES: readonly SiteLanguage[] = ["ar", "en"];

export const SITE_LANGUAGE_LABELS: Record<SiteLanguage, string> = {
  ar: "العربية", // i18n-allow: a language is named in its own script, never translated
  en: "English",
};

export const ARABIC_FLAG_COUNTRIES: readonly PhoneCountry[] = [
  "PS",
  "JO",
  "EG",
  "SA",
  "AE",
  "QA",
  "KW",
  "BH",
  "OM",
  "LB",
  "SY",
  "IQ",
];

export const ENGLISH_FLAG_COUNTRY: PhoneCountry = "GB";

export const HERO_SLIDE_MS = 6000;

export const SITE_PARAM = {
  LANGUAGE: "lang",
  SPECIALTY: "specialty",
  DOCTOR: "doctor",
  TAB: "tab",
  PATIENT: "patient",
} as const;

export const PORTAL_TABS = [
  "overview",
  "appointments",
  "treatments",
  "billing",
  "prescriptions",
  "files",
] as const;

export const PORTAL_PAGE_SIZE = 5;

export const PORTAL_GRID_PAGE_SIZE = 6;

export const PORTAL_TILE_PAGE_SIZE = 8;

export const PORTAL_PAGE_TAIL = 2;
