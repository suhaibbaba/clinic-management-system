import { isRtlLanguage } from "@clinic/shared";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "@web/i18n/locales/ar.json";

export const DEFAULT_LANGUAGE = "ar";

export const isRtl = (language: string): boolean => isRtlLanguage(language);

const LOCALE_FILES = import.meta.glob<{ default: Record<string, unknown> }>([
  "./locales/*.json",
  "!./locales/ar.json",
]);

const LOADERS: Record<string, () => Promise<{ default: Record<string, unknown> }>> =
  Object.fromEntries(
    Object.entries(LOCALE_FILES).map(([path, load]) => [
      path.replace(/^.*\/(\w+)\.json$/, "$1"),
      load,
    ]),
  );

const loaded = new Set<string>([DEFAULT_LANGUAGE]);

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: { tr: ["en", DEFAULT_LANGUAGE], default: [DEFAULT_LANGUAGE] },
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
