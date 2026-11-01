import type { JSX } from "react";
import { Carousel } from "@web/site/components/carousel";
import { PageHero } from "@web/site/components/page-hero";
import { ServiceCard } from "@web/site/components/service-card";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";

export function ServicesPage(): JSX.Element {
  const { site, language, languages, t } = useSite();
  const { services } = site.content;

  return (
    <>
      <PageHero
        id="services"
        eyebrow={orDefault(services.subtitle, language, t("services.eyebrow"), languages)}
        title={orDefault(services.title, language, t("services.pageTitle"), languages)}
        intro={pick(services.intro, language, languages)}
        image={imageOf(site, services.image)}
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12">
        <Carousel
          label={t("nav.services")}
          grid="sm:grid sm:grid-cols-[repeat(auto-fit,minmax(18rem,22rem))] sm:justify-center sm:gap-5"
          data-testid="site-services"
        >
          {services.items.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </Carousel>
      </div>
    </>
  );
}
