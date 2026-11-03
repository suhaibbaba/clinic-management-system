import type { JSX } from "react";
import { Carousel } from "@web/site/components/carousel";
import { ServiceCard } from "@web/site/components/service-card";
import { useSite } from "@web/site/hooks/use-site";

export function ServicesGridBlock(): JSX.Element {
  const { siteDocument, t } = useSite();

  return (
    <Carousel
      label={t("nav.services")}
      grid="sm:grid sm:grid-cols-[repeat(auto-fit,minmax(18rem,22rem))] sm:justify-center sm:gap-5"
      data-testid="site-services"
    >
      {siteDocument.collections.services.items.map((service) => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </Carousel>
  );
}
