import type { PublicSite, SiteLanguage } from "@clinic/shared";
import type { Translate } from "@web/site/i18n";
import { visibleDoctors } from "@web/site/lib/doctors";
import { nameIn, orDefault, pick } from "@web/site/lib/text";
import type { SitePageRoute } from "@web/site/route";

function heading(
  site: PublicSite,
  page: SitePageRoute,
  language: SiteLanguage,
  t: Translate,
): string {
  const { content } = site;
  const { languages } = site.clinic.locale;

  switch (page.kind) {
    case "home":
      return pick(content.hero.title, language, languages);
    case "services":
      return t("nav.services");
    case "doctors":
      return t("nav.doctors");
    case "doctor": {
      const doctor = visibleDoctors(site).find((candidate) => candidate.id === page.id);

      return doctor ? nameIn(doctor.name, language, languages) : t("doctors.notFound");
    }
    case "about":
      return orDefault(content.about.title, language, t("nav.about"), languages);
    case "contact":
      return orDefault(content.contact.title, language, t("nav.contact"), languages);
    case "booking":
      return orDefault(content.booking.title, language, t("nav.booking"), languages);
    case "account":
      return t("portal.title");
    case "notFound":
      return t("notFound.title");
  }
}

export function pageTitle(
  site: PublicSite,
  page: SitePageRoute,
  language: SiteLanguage,
  t: Translate,
): string {
  const name = nameIn(site.clinic.name, language, site.clinic.locale.languages);
  const title = heading(site, page, language, t);

  return title && title !== name ? `${title} — ${name}` : name;
}
