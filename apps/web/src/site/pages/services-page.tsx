import type { JSX } from "react";
import { Carousel } from "@web/site/components/carousel";
import { PageHero } from "@web/site/components/page-hero";
import { Promo } from "@web/site/components/promo";
import { ServiceCard } from "@web/site/components/service-card";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";

export function ServicesPage(): JSX.Element {
  const { site, language, t } = useSite();
  const { services } = site.content;
  const bookable = useBookable();

  return (
    <>
      <PageHero
        id="services"
        eyebrow={orDefault(services.subtitle, language, t("services.eyebrow"))}
        title={orDefault(services.title, language, t("services.pageTitle"))}
        intro={pick(services.intro, language)}
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
        {bookable && (
          <Promo
            testId="site-services-promo"
            title={orDefault(services.promo.title, language, t("services.promo"))}
            image={imageOf(site, services.promo.image)}
            cta={t("services.promoCta")}
          />
        )}
      </div>
    </>
  );
}
