import i18n, { DEFAULT_LANGUAGE, isRtl } from '@web/i18n';

export const LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'clinic.language';

const isLanguage = (value: string | null): value is Language =>
  value !== null && (LANGUAGES as readonly string[]).includes(value);

/**
 * The language chosen last time, if there was one.
 *
 * Wrapped because `localStorage` throws outright in a browser with site data
 * blocked, and a thrown preference read would take the whole app down before
 * the first render. A clinic on a locked-down machine gets Arabic, which is
 * the default anyway.
 */
export function storedLanguage(): Language | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Points `<html>` at a language: `lang` for screen readers and hyphenation,
 * `dir` for layout.
 *
 * On the document element rather than on a React wrapper, because dialogs,
 * drawers and toasts portal to `document.body` — outside any wrapper — and a
 * menu that opened left-to-right inside an Arabic app is the bug this avoids.
 */
export function applyLanguageToDocument(language: string): void {
  const root = document.documentElement;

  root.lang = language;
  root.dir = isRtl(language) ? 'rtl' : 'ltr';
}

/**
 * Switches language, remembers it, and flips the document's direction.
 *
 * The document is updated *first*, on purpose. Changing the language is what
 * re-renders the tree, and the direction-relative icons read `dir` off the
 * document as they render — so doing it the other way round repaints the whole
 * app with the previous direction and leaves every "forward" chevron pointing
 * backwards until something else happens to re-render it.
 */
export async function changeLanguage(language: Language): Promise<void> {
  applyLanguageToDocument(language);
  await i18n.changeLanguage(language);

  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // A refused write costs the preference on the next load, nothing more.
  }
}

/**
 * Restores the stored choice at boot.
 *
 * Called before the first paint so the app never renders Arabic-RTL for a
 * frame and then snaps to English-LTR.
 */
export function initLanguage(): void {
  const language = storedLanguage() ?? DEFAULT_LANGUAGE;

  if (language !== i18n.language) {
    void i18n.changeLanguage(language);
  }

  applyLanguageToDocument(language);
}
