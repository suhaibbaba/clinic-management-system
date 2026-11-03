import {
  SITE_BLOCK_TYPE,
  type PhoneCountry,
  type SiteBlockType,
  type SiteLanguage,
} from "@clinic/shared";

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

export const BODY_BLOCKS: ReadonlySet<SiteBlockType> = new Set([
  SITE_BLOCK_TYPE.SERVICES_GRID,
  SITE_BLOCK_TYPE.DOCTORS_GRID,
  SITE_BLOCK_TYPE.ABOUT_PILLARS,
  SITE_BLOCK_TYPE.ABOUT_VALUES,
  SITE_BLOCK_TYPE.CONTACT_MAIN,
  SITE_BLOCK_TYPE.CONTACT_WELCOME,
]);

export const BLOCK_BODY_CLASS = "mx-auto my-12 max-w-6xl px-4";

export const MAP_SPAN = 0.006;
