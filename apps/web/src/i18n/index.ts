import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "@web/i18n/locales/ar.json";

export const DEFAULT_LANGUAGE = "ar";

const RTL_LANGUAGES = new Set(["ar"]);

export const isRtl = (language: string): boolean => RTL_LANGUAGES.has(language.split("-")[0] ?? "");

// Arabic ships in the bundle: it is the default and the fallback. Every other language is a chunk
// fetched the first time somebody picks it. Strings never live in components.
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

/** Fetches a language's strings once; resolves at once for one already in memory. */
export async function loadLanguage(language: string): Promise<void> {
  const loader = LOADERS[language];

  if (loaded.has(language) || !loader) {
    return;
  }

  const { default: strings } = await loader();

  // Not overwriting: a clinic's overrides may have arrived first, and they win over the file.
  i18n.addResourceBundle(language, "translation", strings, true, false);
  loaded.add(language);
}

export default i18n;
