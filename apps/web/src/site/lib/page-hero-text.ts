import {
  SITE_PAGE_KIND,
  type SiteBlockOf,
  type SITE_BLOCK_TYPE,
  type SiteLanguage,
  type SitePageKind,
} from "@clinic/shared";
import type { Translate } from "@web/site/i18n";
import { orDefault, pick } from "@web/site/lib/text";

export interface PageHeroText {
  readonly id: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly intro?: string;
}

export function pageHeroText(
  block: SiteBlockOf<typeof SITE_BLOCK_TYPE.PAGE_HERO>,
  kind: SitePageKind,
  fallbackTitle: string,
  language: SiteLanguage,
  languages: readonly SiteLanguage[],
  t: Translate,
): PageHeroText {
  const text = (value: Parameters<typeof pick>[0]): string => pick(value, language, languages);
  const titled = (value: Parameters<typeof orDefault>[0], key: string): string =>
    orDefault(value, language, t(key), languages);

  switch (kind) {
    case SITE_PAGE_KIND.SERVICES:
      return {
        id: kind,
        eyebrow: titled(block.subtitle, "services.eyebrow"),
        title: titled(block.title, "services.pageTitle"),
        intro: text(block.intro),
      };
    case SITE_PAGE_KIND.DOCTORS:
      return {
        id: kind,
        title: titled(block.title, "doctors.title"),
        subtitle: titled(block.subtitle, "doctors.subtitle"),
      };
    case SITE_PAGE_KIND.ABOUT:
      return {
        id: kind,
        eyebrow: text(block.eyebrow),
        title: titled(block.title, "about.title"),
        subtitle: text(block.subtitle),
        intro: text(block.intro)
          .split(/\n{2,}/)
          .filter(Boolean)
          .join(" "),
      };
    case SITE_PAGE_KIND.CONTACT:
      return {
        id: kind,
        title: titled(block.title, "contact.title"),
        subtitle: titled(block.subtitle, "contact.subtitleDefault"),
        intro: text(block.intro),
      };
    default:
      return {
        id: kind,
        eyebrow: text(block.eyebrow),
        title: orDefault(block.title, language, fallbackTitle, languages),
        subtitle: text(block.subtitle),
        intro: text(block.intro),
      };
  }
}
