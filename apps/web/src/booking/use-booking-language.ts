import {
  DEFAULT_LANGUAGE,
  isLanguageCode,
  languageDirection,
  type ClinicLocale,
  type LanguageCode,
} from "@clinic/shared";
import { useCallback, useEffect, useState } from "react";
import { LANGUAGE_PARAM } from "@web/booking/constants";
import { activateBookingLocale } from "@web/booking/i18n";
import { languageUrl } from "@web/booking/route";

export interface BookingLanguage {
  readonly language: LanguageCode;
  readonly languages: readonly LanguageCode[];
  readonly href: (language: LanguageCode) => string;
  readonly choose: (language: LanguageCode) => void;
}

const requestedLanguage = (): string | null =>
  new URLSearchParams(window.location.search).get(LANGUAGE_PARAM);

export function useBookingLanguage(
  locale: ClinicLocale | undefined,
  {
    fixed,
    standalone = true,
  }: { readonly fixed?: LanguageCode; readonly standalone?: boolean } = {},
): BookingLanguage {
  const [requested, setRequested] = useState(() => (standalone ? requestedLanguage() : null));

  useEffect(() => {
    if (!standalone) {
      return;
    }

    const sync = (): void => setRequested(requestedLanguage());

    window.addEventListener("popstate", sync);

    return () => window.removeEventListener("popstate", sync);
  }, [standalone]);

  const primaryLanguage = locale?.primaryLanguage ?? DEFAULT_LANGUAGE;
  const languages: readonly LanguageCode[] = locale?.languages ?? [];
  const offered = (code: string | null): code is LanguageCode =>
    isLanguageCode(code) && (locale === undefined || languages.includes(code));
  const language = fixed ?? (offered(requested) ? requested : primaryLanguage);

  activateBookingLocale({ language, primaryLanguage, clock: locale?.clock ?? "12h" });

  useEffect(() => {
    if (!standalone) {
      return;
    }

    document.documentElement.lang = language;
    document.documentElement.dir = languageDirection(language);
  }, [language, standalone]);

  const choose = useCallback(
    (next: LanguageCode) => {
      window.history.replaceState(window.history.state, "", languageUrl(next, primaryLanguage));
      setRequested(next === primaryLanguage ? null : next);
    },
    [primaryLanguage],
  );

  const href = useCallback(
    (next: LanguageCode) => {
      const url = languageUrl(next, primaryLanguage);

      return `${url.pathname}${url.search}${url.hash}`;
    },
    [primaryLanguage],
  );

  return {
    language,
    languages: standalone && fixed === undefined ? languages : [],
    href,
    choose,
  };
}
