import {
  languageDirection,
  SITE_PAGE_KIND,
  SITE_SECTION,
  sitePageEnabled,
  sitePageFor,
  type PublicSite,
  type SitePreviewEdit,
  type SiteSection,
} from "@clinic/shared";
import { useCallback, useEffect, useMemo, type JSX } from "react";
import { SITE_PARAM } from "@web/site/constants";
import { usePortalAccount } from "@web/site/hooks/use-portal-account";
import { useReveal } from "@web/site/hooks/use-reveal";
import { useSiteLocation } from "@web/site/hooks/use-site-location";
import { translator } from "@web/site/i18n";
import { BlockPage } from "@web/site/blocks/block-page";
import { SiteContext } from "@web/site/lib/site-context";
import { pageTitle } from "@web/site/lib/page-title";
import { PortalContext } from "@web/site/lib/portal-context";
import { siteLanguage } from "@web/site/lib/text";
import { AccountPage } from "@web/site/pages/account-page";
import { DoctorPage } from "@web/site/pages/doctor-page";
import { NotFoundPage } from "@web/site/pages/not-found-page";
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
      return <BlockPage kind={SITE_PAGE_KIND.HOME} />;
    case "services":
      return <BlockPage kind={SITE_PAGE_KIND.SERVICES} />;
    case "doctors":
      return <BlockPage kind={SITE_PAGE_KIND.DOCTORS} />;
    case "doctor":
      return <DoctorPage id={page.id} />;
    case "about":
      return <BlockPage kind={SITE_PAGE_KIND.ABOUT} />;
    case "contact":
      return <BlockPage kind={SITE_PAGE_KIND.CONTACT} />;
    case "booking":
      return <BlockPage kind={SITE_PAGE_KIND.BOOKING} />;
    case "account":
      return <AccountPage />;
    case "notFound":
      return <NotFoundPage />;
  }
}

export function SitePage({
  site,
  preview,
  edit,
  base,
}: {
  readonly site: PublicSite;
  readonly preview: boolean;
  readonly edit: SitePreviewEdit | null;
  readonly base: string;
}): JSX.Element {
  const { pathname, params, navigate, setParams } = useSiteLocation();
  const requested = params.get(SITE_PARAM.LANGUAGE);
  const { languages, primaryLanguage } = site.clinic.locale;
  const language = siteLanguage(requested, site.clinic.locale);
  const t = useMemo(() => translator(language), [language]);
  const siteDocument = site.document;
  const routed = sitePage(pathname, base);
  const section = SECTION_OF[routed.kind];
  const open =
    edit !== null ||
    (section === SITE_SECTION.PORTAL
      ? siteDocument.portal
      : section === undefined || sitePageEnabled(siteDocument, sitePageFor(section)));
  const page: SitePageRoute =
    !open || (section === SITE_SECTION.BOOKING && !site.clinic.bookingEnabled)
      ? { kind: "notFound" }
      : routed;
  const portal = usePortalAccount(!preview && siteDocument.portal);

  const href = useCallback(
    (path: string, extra: Record<string, string> = {}) => {
      const query = new URLSearchParams(extra);

      if (language !== primaryLanguage) {
        query.set(SITE_PARAM.LANGUAGE, language);
      }

      const search = query.toString();
      const target = path === "/" ? base || "/" : `${base}${path}`;

      return search ? `${target}?${search}` : target;
    },
    [base, language, primaryLanguage],
  );

  const value = useMemo(
    () => ({
      site,
      siteDocument,
      language,
      languages,
      t,
      preview,
      edit,
      page,
      params,
      setParams,
      href,
      navigate,
    }),
    [
      site,
      siteDocument,
      language,
      languages,
      t,
      preview,
      edit,
      page,
      params,
      setParams,
      href,
      navigate,
    ],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = languageDirection(language);
  }, [language]);

  useEffect(() => {
    document.title = pageTitle(site, siteDocument, page, language, t);
  }, [site, siteDocument, page, language, t]);

  useReveal(page.kind === "doctor" ? `doctor-${page.id}` : page.kind, edit === null);

  return (
    <SiteContext.Provider value={value}>
      <PortalContext.Provider value={portal}>
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
      </PortalContext.Provider>
    </SiteContext.Provider>
  );
}
