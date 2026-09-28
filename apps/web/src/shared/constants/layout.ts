import type { Language } from "@web/i18n/language";

export const PATIENTS_PATH = "/patients";

export const DASHBOARD_PATH = "/dashboard";

export const SEARCH_SUGGESTIONS = 5;

export const SEARCH_MIN_TERM = 2;

export const LANGUAGE_LABELS: Record<Language, string> = {
  ar: "العربية", // i18n-allow: a language is named in its own script, never translated
  en: "English",
};
