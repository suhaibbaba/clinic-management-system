import { DEFAULT_PHONE_COUNTRY, isPhoneCountry, numberSeparators } from "@clinic/shared";
import { LocaleFormatProvider, PhoneCountryProvider, ToastProvider } from "@clinic/ui";
import { UiProvider } from "@clinic/ui/theme";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { createQueryClient } from "@web/app/query-client";
import { SessionProvider, useSession } from "@web/shared/providers/session";
import { isRtl } from "@web/i18n";
import { adoptClinicLanguage } from "@web/i18n/language";
import { setClinicLocale } from "@web/shared/lib/clinic-locale";
import { OfflineBar } from "@web/shared/components/pwa/offline-bar";
import { UpdateBar } from "@web/shared/components/pwa/update-bar";
import { DocumentBranding } from "@web/shared/lib/document-branding";
import { DocumentTitleProvider } from "@web/shared/providers/document-title";
import { abuObaidTheme } from "@web/theme";

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  const { i18n } = useTranslation();
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <UiProvider
      theme={abuObaidTheme}
      direction={isRtl(i18n.language) ? "rtl" : "ltr"}
      lang={i18n.language}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SessionProvider>
            <DocumentBranding />
            <OfflineBar />
            <UpdateBar />
            <ClinicPhoneCountry>
              <DocumentTitleProvider>{children}</DocumentTitleProvider>
            </ClinicPhoneCountry>
          </SessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </UiProvider>
  );
}

function ClinicPhoneCountry({ children }: { readonly children: ReactNode }): JSX.Element {
  const clinic = useSession().user?.clinic;
  const country = clinic?.country;
  const locale = clinic?.locale;

  if (locale) {
    setClinicLocale(locale);
  }

  useEffect(() => {
    if (locale) {
      void adoptClinicLanguage(locale);
    }
  }, [locale]);

  const format = useMemo(
    () => ({
      separators: numberSeparators(locale?.numberLocale),
      weekStartsOn: locale?.weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined,
    }),
    [locale],
  );

  return (
    <PhoneCountryProvider country={isPhoneCountry(country) ? country : DEFAULT_PHONE_COUNTRY}>
      <LocaleFormatProvider value={format}>{children}</LocaleFormatProvider>
    </PhoneCountryProvider>
  );
}
