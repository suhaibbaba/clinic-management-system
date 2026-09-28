import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "@web/i18n/locales/ar.json";

export const DEFAULT_LANGUAGE = "ar";

const RTL_LANGUAGES = new Set(["ar"]);

export const isRtl = (language: string): boolean => RTL_LANGUAGES.has(language.split("-")[0] ?? "");

const LOADERS: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import("@web/i18n/locales/en.json"),
};

const loaded = new Set<string>([DEFAULT_LANGUAGE]);

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

export async function loadLanguage(language: string): Promise<void> {
  const loader = LOADERS[language];

  if (loaded.has(language) || !loader) {
    return;
  }

  const { default: strings } = await loader();

  i18n.addResourceBundle(language, "translation", strings, true, false);
  loaded.add(language);
}

export default i18n;
