import { DEFAULT_LANGUAGE, type ClockFormat, type LanguageCode } from "@clinic/shared";
import ar from "@web/booking/locales/ar.json";
import en from "@web/booking/locales/en.json";
import tr from "@web/booking/locales/tr.json";

type Dictionary = { readonly [key: string]: string | Dictionary };

const DICTIONARIES: Record<LanguageCode, Dictionary> = { ar, en, tr };

export interface BookingLocale {
  readonly language: LanguageCode;
  readonly primaryLanguage: LanguageCode;
  readonly clock: ClockFormat;
}

let active: BookingLocale = {
  language: DEFAULT_LANGUAGE,
  primaryLanguage: DEFAULT_LANGUAGE,
  clock: "12h",
};

export function activateBookingLocale(locale: BookingLocale): void {
  active = locale;
}

export function bookingLocale(): BookingLocale {
  return active;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const value = key
    .split(".")
    .reduce<string | Dictionary | undefined>(
      (node, part) => (typeof node === "object" ? node[part] : undefined),
      DICTIONARIES[active.language],
    );

  if (typeof value !== "string") {
    return key;
  }

  if (!vars) {
    return value;
  }

  return value.replaceAll(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
