import {
  SITE_BLOCK_TYPE,
  SITE_PAGE_KIND,
  siteDocumentPage,
  type PublicSite,
  type SiteDocument,
  type SiteLanguage,
  type SitePageKind,
  type SiteText,
} from "@clinic/shared";
import type { Translate } from "@web/site/i18n";
import { visibleDoctors } from "@web/site/lib/doctors";
import { nameIn, orDefault, pick } from "@web/site/lib/text";
import type { SitePageRoute } from "@web/site/route";

function headingText(siteDocument: SiteDocument, kind: SitePageKind): SiteText {
  const first = siteDocumentPage(siteDocument, kind)?.blocks[0];

  switch (first?.type) {
    case SITE_BLOCK_TYPE.HERO:
    case SITE_BLOCK_TYPE.PAGE_HERO:
    case SITE_BLOCK_TYPE.BOOKING:
      return first.title;
    default:
      return {};
  }
}

function heading(
  site: PublicSite,
  siteDocument: SiteDocument,
  page: SitePageRoute,
  language: SiteLanguage,
  t: Translate,
): string {
  const { languages } = site.clinic.locale;
  const titled = (kind: SitePageKind, fallback: string): string =>
    orDefault(headingText(siteDocument, kind), language, fallback, languages);

  switch (page.kind) {
    case "home":
      return pick(headingText(siteDocument, SITE_PAGE_KIND.HOME), language, languages);
    case "services":
      return t("nav.services");
    case "doctors":
      return t("nav.doctors");
    case "doctor": {
      const doctor = visibleDoctors(site, siteDocument).find(
        (candidate) => candidate.id === page.id,
      );

      return doctor ? nameIn(doctor.name, language, languages) : t("doctors.notFound");
    }
    case "about":
      return titled(SITE_PAGE_KIND.ABOUT, t("nav.about"));
    case "contact":
      return titled(SITE_PAGE_KIND.CONTACT, t("nav.contact"));
    case "booking":
      return titled(SITE_PAGE_KIND.BOOKING, t("nav.booking"));
    case "account":
      return t("portal.title");
    case "notFound":
      return t("notFound.title");
  }
}

export function pageTitle(
  site: PublicSite,
  siteDocument: SiteDocument,
  page: SitePageRoute,
  language: SiteLanguage,
  t: Translate,
): string {
  const name = nameIn(site.clinic.name, language, site.clinic.locale.languages);
  const title = heading(site, siteDocument, page, language, t);

  return title && title !== name ? `${title} — ${name}` : name;
}
