import type { SiteLanguage } from "@clinic/shared";

export const SITE_LANGUAGE_LABELS: Record<SiteLanguage, string> = {
  ar: "العربية", // i18n-allow: a language is named in its own script, never translated
  en: "English",
};

export const SITE_LANGUAGE_SHORT: Record<SiteLanguage, string> = {
  ar: "ع", // i18n-allow: a language is named in its own script, never translated
  en: "EN",
};

export const HERO_SLIDE_MS = 6000;

export const HOME_SERVICES = 6;

export const HOME_DOCTORS = 4;

export const SITE_PARAM = {
  LANGUAGE: "lang",
  SPECIALTY: "specialty",
  DOCTOR: "doctor",
} as const;
