import { DEFAULT_LANGUAGE, languageDirection } from "@clinic/shared";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "@web/vendor/locales/ar.json";
import en from "@web/vendor/locales/en.json";
import tr from "@web/vendor/locales/tr.json";
import { VENDOR_LANGUAGE_KEY } from "@web/vendor/constants";

const RESOURCES = { ar, en, tr } as const;

const stored = (): string => {
  try {
    return localStorage.getItem(VENDOR_LANGUAGE_KEY) ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

export const VENDOR_LANGUAGES = Object.keys(RESOURCES);

export function applyDirection(language: string): void {
  document.documentElement.lang = language;
  document.documentElement.dir = languageDirection(language);
}

export function changeVendorLanguage(language: string): void {
  try {
    localStorage.setItem(VENDOR_LANGUAGE_KEY, language);
  } catch {}

  applyDirection(language);
  void i18n.changeLanguage(language);
}

const initial = VENDOR_LANGUAGES.includes(stored()) ? stored() : DEFAULT_LANGUAGE;

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    Object.entries(RESOURCES).map(([language, strings]) => [language, { translation: strings }]),
  ),
  lng: initial,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

applyDirection(initial);

export default i18n;
