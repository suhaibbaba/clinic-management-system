import {
  SITE_PAGE_KIND,
  sitePageEnabled,
  type SITE_BLOCK_TYPE,
  type SiteBlockOf,
} from "@clinic/shared";
import type { JSX } from "react";
import { Marquee } from "@web/site/components/marquee";
import { PillLink } from "@web/site/components/pill-link";
import { ServiceTile } from "@web/site/components/service-tile";
import { ShowcaseHeading } from "@web/site/components/showcase-heading";
import { useSite } from "@web/site/hooks/use-site";
import { orDefault } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function ServicesTeaser({
  block,
}: {
  readonly block: SiteBlockOf<typeof SITE_BLOCK_TYPE.SERVICES_TEASER>;
}): JSX.Element | null {
  const { siteDocument, language, languages, t } = useSite();
  const { items } = siteDocument.collections.services;

  if (!sitePageEnabled(siteDocument, SITE_PAGE_KIND.SERVICES) || items.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-services-teaser"
      aria-labelledby="services-teaser-title"
      className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14"
    >
      <ShowcaseHeading
        id="services-teaser"
        eyebrow={orDefault(block.subtitle, language, t("services.eyebrow"), languages)}
        title={orDefault(block.title, language, t("services.pageTitle"), languages)}
        action={
          <PillLink to={SITE_PATH.SERVICES} tone="outline" data-testid="site-services-more">
            {t("home.servicesAll")}
          </PillLink>
        }
      />
      <Marquee label={t("nav.services")} item="w-60 sm:w-64" data-testid="site-services-carousel">
        {items.map((service) => (
          <ServiceTile key={service.id} service={service} />
        ))}
      </Marquee>
    </section>
  );
}
