import { TRANSLATION_LANGUAGES, type TranslationBundle } from "@clinic/shared";
import { useEffect } from "react";
import i18n from "@web/i18n";

// Merged over the bundled locale files rather than replacing them: a clinic stores only the strings
// it changed, so wording improved in a deploy still reaches every key it never touched.
export function applyTranslationOverrides(bundle: TranslationBundle): void {
  for (const language of TRANSLATION_LANGUAGES) {
    i18n.addResourceBundle(language, "translation", bundle[language], true, true);
  }

  // i18next caches what it has already resolved, so a screen holding a rendered string keeps the
  // old wording until something tells it to read again.
  void i18n.emit("languageChanged", i18n.language);
}

export function useApplyTranslationOverrides(bundle: TranslationBundle | undefined): void {
  useEffect(() => {
    if (bundle) {
      applyTranslationOverrides(bundle);
    }
  }, [bundle]);
}
