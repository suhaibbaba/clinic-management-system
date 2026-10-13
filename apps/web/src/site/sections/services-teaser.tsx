import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { Carousel } from "@web/site/components/carousel";
import { PillLink } from "@web/site/components/pill-link";
import { SectionHeading } from "@web/site/components/section-heading";
import { ServiceCard } from "@web/site/components/service-card";
import { HOME_SERVICES } from "@web/site/constants";
import { useSite } from "@web/site/hooks/use-site";
import { orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function ServicesTeaser(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { services } = site.content;

  if (!site.content.sections.includes(SITE_SECTION.SERVICES) || services.items.length === 0) {
    return null;
  }

  return (
    <section data-testid="site-services-teaser" className="site-wash">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14">
        <SectionHeading
          id="services-teaser"
          align="center"
          eyebrow={orDefault(services.subtitle, language, t("services.eyebrow"))}
          title={orDefault(services.title, language, t("services.pageTitle"))}
          subtitle={pick(services.intro, language)}
        />
        <Carousel
          label={t("nav.services")}
          grid="sm:grid sm:grid-cols-2 lg:grid-cols-3"
          data-testid="site-services-carousel"
        >
          {services.items.slice(0, HOME_SERVICES).map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </Carousel>
        <PillLink
          to={SITE_PATH.SERVICES}
          tone="outline"
          className="self-center"
          data-testid="site-services-more"
        >
          {t("home.servicesAll")}
        </PillLink>
      </div>
    </section>
  );
}
