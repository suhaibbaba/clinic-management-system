import { LANGUAGE_CODES, type ClinicLocale, type LanguageCode } from "@clinic/shared";
import i18n, { DEFAULT_LANGUAGE, isRtl, loadLanguage } from "@web/i18n";

export const LANGUAGES = LANGUAGE_CODES;
export type Language = LanguageCode;

const STORAGE_KEY = "clinic.language";

const isLanguage = (value: string | null): value is Language =>
  value !== null && (LANGUAGES as readonly string[]).includes(value);

export function storedLanguage(): Language | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export function applyLanguageToDocument(language: string): void {
  const root = document.documentElement;

  root.lang = language;
  root.dir = isRtl(language) ? "rtl" : "ltr";
}

export async function changeLanguage(language: Language): Promise<void> {
  await loadLanguage(language);
  applyLanguageToDocument(language);
  await i18n.changeLanguage(language);

  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {}
}

export async function initLanguage(): Promise<void> {
  const stored = storedLanguage() ?? DEFAULT_LANGUAGE;
  const language = await loadLanguage(stored).then(
    () => stored,
    () => DEFAULT_LANGUAGE,
  );

  if (language !== i18n.language) {
    await i18n.changeLanguage(language);
  }

  applyLanguageToDocument(language);
}

export async function adoptClinicLanguage(
  locale: Pick<ClinicLocale, "languages" | "primaryLanguage">,
) {
  const stored = storedLanguage();
  const offered: readonly string[] = locale.languages;

  if (stored !== null && offered.includes(stored)) {
    return;
  }

  const language = locale.primaryLanguage;

  if (i18n.language === language) {
    return;
  }

  await loadLanguage(language);
  applyLanguageToDocument(language);
  await i18n.changeLanguage(language);
}
