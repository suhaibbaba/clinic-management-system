import i18n, { DEFAULT_LANGUAGE, isRtl } from '@web/i18n';

export const LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'clinic.language';

const isLanguage = (value: string | null): value is Language =>
  value !== null && (LANGUAGES as readonly string[]).includes(value);

// Wrapped because `localStorage` throws outright where site data is blocked, and that would take
// the app down before the first render.
export function storedLanguage(): Language | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

// On the document element rather than a React wrapper, because dialogs, drawers and toasts portal
// to `document.body`, outside any wrapper.
export function applyLanguageToDocument(language: string): void {
  const root = document.documentElement;

  root.lang = language;
  root.dir = isRtl(language) ? 'rtl' : 'ltr';
}

// The document is updated first: the language change is what re-renders, and direction-relative
// icons read `dir` as they render.
export async function changeLanguage(language: Language): Promise<void> {
  applyLanguageToDocument(language);
  await i18n.changeLanguage(language);

  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // A refused write costs the preference on the next load, nothing more.
  }
}

// Called before the first paint, so the app never renders Arabic-RTL for a frame and then snaps to
// English-LTR.
export function initLanguage(): void {
  const language = storedLanguage() ?? DEFAULT_LANGUAGE;

  if (language !== i18n.language) {
    void i18n.changeLanguage(language);
  }

  applyLanguageToDocument(language);
}
