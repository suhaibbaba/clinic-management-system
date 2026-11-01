import type { PhoneCountry, SiteLanguage } from "@clinic/shared";

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

export const LANGUAGE_FLAGS: Record<
  SiteLanguage,
  { readonly countries: readonly PhoneCountry[]; readonly fallback: PhoneCountry }
> = {
  ar: { countries: ARABIC_FLAG_COUNTRIES, fallback: "PS" },
  en: { countries: [], fallback: "GB" },
  tr: { countries: [], fallback: "TR" },
};

export const HERO_SLIDE_MS = 6000;

export const HERO_FACES_MAX = 4;

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
