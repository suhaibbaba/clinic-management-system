import type { SiteService } from "@clinic/shared";
import type { JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { SiteLink } from "@web/site/components/site-link";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function ServiceTile({ service }: { readonly service: SiteService }): JSX.Element {
  const { site, language } = useSite();
  const description = pick(service.description, language);

  return (
    <SiteLink
      to={SITE_PATH.SERVICES}
      data-testid={`site-service-tile-${service.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      <SiteImage
        src={imageOf(site, service.image)}
        className="aspect-[4/3] w-full"
        fallback={<SiteIcon name={service.icon} className="size-12" />}
      />
      <div className="relative flex flex-1 flex-col items-center gap-1.5 px-4 pt-9 pb-5 text-center">
        <span className="absolute -top-7 inline-flex size-14 items-center justify-center rounded-pill border-4 border-surface bg-primary-50 text-primary-600 shadow-float">
          <SiteIcon name={service.icon} className="size-6" />
        </span>
        <span
          aria-hidden
          className="absolute end-3 top-3 inline-flex size-7 items-center justify-center rounded-pill border border-line text-primary-700 transition-colors group-hover:border-primary-600 group-hover:bg-primary-600 group-hover:text-ink-inverse"
        >
          <SiteIcon name="arrow-end" className="size-4" />
        </span>
        <h3 className="text-heading font-bold text-primary-900">{pick(service.title, language)}</h3>
        {description && <p className="line-clamp-2 text-label text-ink-muted">{description}</p>}
      </div>
    </SiteLink>
  );
}
