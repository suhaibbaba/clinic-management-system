import { SITE_SECTION, type PublicSite, type SiteSection } from "@clinic/shared";
import { useCallback, useEffect, useMemo, type JSX } from "react";
import { SITE_PARAM } from "@web/site/constants";
import { useReveal } from "@web/site/hooks/use-reveal";
import { useSiteLocation } from "@web/site/hooks/use-site-location";
import { translator } from "@web/site/i18n";
import { SiteContext } from "@web/site/lib/site-context";
import { pageTitle } from "@web/site/lib/page-title";
import { isSiteLanguage } from "@web/site/lib/text";
import { AboutPage } from "@web/site/pages/about-page";
import { AccountPage } from "@web/site/pages/account-page";
import { BookingPage } from "@web/site/pages/booking-page";
import { ContactPage } from "@web/site/pages/contact-page";
import { DoctorPage } from "@web/site/pages/doctor-page";
import { DoctorsPage } from "@web/site/pages/doctors-page";
import { HomePage } from "@web/site/pages/home-page";
import { NotFoundPage } from "@web/site/pages/not-found-page";
import { ServicesPage } from "@web/site/pages/services-page";
import { sitePage, type SitePageRoute } from "@web/site/route";
import { SiteFooter } from "@web/site/sections/site-footer";
import { SiteHeader } from "@web/site/sections/site-header";

const SECTION_OF: Partial<Record<SitePageRoute["kind"], SiteSection>> = {
  services: SITE_SECTION.SERVICES,
  doctors: SITE_SECTION.DOCTORS,
  doctor: SITE_SECTION.DOCTORS,
  about: SITE_SECTION.ABOUT,
  contact: SITE_SECTION.CONTACT,
  booking: SITE_SECTION.BOOKING,
  account: SITE_SECTION.PORTAL,
};

function PageFor({ page }: { readonly page: SitePageRoute }): JSX.Element {
  switch (page.kind) {
    case "home":
      return <HomePage />;
    case "services":
      return <ServicesPage />;
    case "doctors":
      return <DoctorsPage />;
    case "doctor":
      return <DoctorPage id={page.id} />;
    case "about":
      return <AboutPage />;
    case "contact":
      return <ContactPage />;
    case "booking":
      return <BookingPage />;
    case "account":
      return <AccountPage />;
    case "notFound":
      return <NotFoundPage />;
  }
}

export function SitePage({
  site,
  preview,
  base,
}: {
  readonly site: PublicSite;
  readonly preview: boolean;
  readonly base: string;
}): JSX.Element {
  const { pathname, params, navigate, setParams } = useSiteLocation();
  const requested = params.get(SITE_PARAM.LANGUAGE);
  const language = isSiteLanguage(requested) ? requested : "ar";
  const t = useMemo(() => translator(language), [language]);
  const routed = sitePage(pathname, base);
  const section = SECTION_OF[routed.kind];
  const page: SitePageRoute =
    section !== undefined &&
    (!site.content.sections.includes(section) ||
      (section === SITE_SECTION.BOOKING && !site.clinic.bookingEnabled))
      ? { kind: "notFound" }
      : routed;

  const href = useCallback(
    (path: string, extra: Record<string, string> = {}) => {
      const query = new URLSearchParams(extra);

      if (language !== "ar") {
        query.set(SITE_PARAM.LANGUAGE, language);
      }

      const search = query.toString();
      const target = path === "/" ? base || "/" : `${base}${path}`;

      return search ? `${target}?${search}` : target;
    },
    [base, language],
  );

  const value = useMemo(
    () => ({ site, language, t, preview, page, params, setParams, href, navigate }),
    [site, language, t, preview, page, params, setParams, href, navigate],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    document.title = pageTitle(site, page, language, t);
  }, [site, page, language, t]);

  useReveal(page.kind === "doctor" ? `doctor-${page.id}` : page.kind);

  return (
    <SiteContext.Provider value={value}>
      <a
        href="#site-main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 text-value text-primary-700 shadow-float focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("skip")}
      </a>
      <div
        data-testid="site-page"
        className="flex min-h-full min-w-0 flex-col overflow-x-clip bg-surface wrap-break-word"
      >
        <SiteHeader />
        <main
          id="site-main"
          tabIndex={-1}
          data-page={page.kind}
          key={page.kind === "doctor" ? `doctor-${page.id}` : page.kind}
          className="site-page-enter min-w-0 flex-1 outline-none"
        >
          <PageFor page={page} />
        </main>
        <SiteFooter />
      </div>
    </SiteContext.Provider>
  );
}
