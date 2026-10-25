import {
  DEFAULT_PHONE_COUNTRY,
  isPhoneCountry,
  type PhoneCountry,
  type SiteLanguage,
} from "@clinic/shared";
import { ARABIC_FLAG_COUNTRIES, ENGLISH_FLAG_COUNTRY } from "@web/site/constants";

export function languageFlag(language: SiteLanguage, clinicCountry: string): PhoneCountry {
  if (language === "en") {
    return ENGLISH_FLAG_COUNTRY;
  }

  return isPhoneCountry(clinicCountry) && ARABIC_FLAG_COUNTRIES.includes(clinicCountry)
    ? clinicCountry
    : DEFAULT_PHONE_COUNTRY;
}
