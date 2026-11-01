import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { PillLink } from "@web/site/components/pill-link";
import { ServiceTile } from "@web/site/components/service-tile";
import { ShowcaseHeading } from "@web/site/components/showcase-heading";
import { Slider } from "@web/site/components/slider";
import { useSite } from "@web/site/hooks/use-site";
import { orDefault } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function ServicesTeaser(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { services } = site.content;

  if (!site.content.sections.includes(SITE_SECTION.SERVICES) || services.items.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-services-teaser"
      aria-labelledby="services-teaser-title"
      className="bg-primary-50"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-6 pb-14">
        <ShowcaseHeading
          id="services-teaser"
          eyebrow={orDefault(services.subtitle, language, t("services.eyebrow"))}
          title={orDefault(services.title, language, t("services.pageTitle"))}
          action={
            <PillLink to={SITE_PATH.SERVICES} tone="outline" data-testid="site-services-more">
              {t("home.servicesAll")}
            </PillLink>
          }
        />
        <Slider
          label={t("nav.services")}
          item="w-[72%] sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-4rem)/5)]"
          data-testid="site-services-carousel"
        >
          {services.items.map((service) => (
            <ServiceTile key={service.id} service={service} />
          ))}
        </Slider>
      </div>
    </section>
  );
}
