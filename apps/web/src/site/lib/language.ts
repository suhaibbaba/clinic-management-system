import {
  isPhoneCountry,
  languageDefinition,
  type PhoneCountry,
  type SiteLanguage,
} from "@clinic/shared";
import { LANGUAGE_FLAGS } from "@web/site/constants";

export function languageFlag(language: SiteLanguage, clinicCountry: string): PhoneCountry {
  const { countries, fallback } = LANGUAGE_FLAGS[language];

  return isPhoneCountry(clinicCountry) && countries.includes(clinicCountry)
    ? clinicCountry
    : fallback;
}

export const languageLabel = (language: SiteLanguage): string =>
  languageDefinition(language).nativeName;
