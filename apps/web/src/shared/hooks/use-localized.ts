import { localized, type LocalizedText } from "@clinic/shared";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useClinicLanguages } from "@web/shared/hooks/use-clinic-languages";

export function useLocalized(): (text: LocalizedText | null | undefined) => string {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const languages = useClinicLanguages();

  return useCallback(
    (text: LocalizedText | null | undefined) => localized(text, language, languages),
    [language, languages],
  );
}
