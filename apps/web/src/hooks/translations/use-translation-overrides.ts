import { TRANSLATION_LANGUAGES, type TranslationBundle } from "@clinic/shared";
import { useEffect } from "react";
import i18n from "@web/i18n";

export function applyTranslationOverrides(bundle: TranslationBundle): void {
  for (const language of TRANSLATION_LANGUAGES) {
    i18n.addResourceBundle(language, "translation", bundle[language], true, true);
  }

  void i18n.emit("languageChanged", i18n.language);
}

export function useApplyTranslationOverrides(bundle: TranslationBundle | undefined): void {
  useEffect(() => {
    if (bundle) {
      applyTranslationOverrides(bundle);
    }
  }, [bundle]);
}
