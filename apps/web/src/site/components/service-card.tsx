import type { SiteService } from "@clinic/shared";
import type { JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { pick } from "@web/site/lib/text";

export function ServiceCard({ service }: { readonly service: SiteService }): JSX.Element {
  const { site, language } = useSite();
  const description = pick(service.description, language);
  const image = imageOf(site, service.image);

  return (
    <article
      data-testid={`site-service-${service.id}`}
      className="group flex h-full min-h-40 items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 self-start">
        <h3 className="text-heading font-bold text-primary-900">{pick(service.title, language)}</h3>
        {description && <p className="text-label text-ink-muted">{description}</p>}
      </div>
      {image ? (
        <SiteImage
          src={image}
          fit="contain"
          wash={false}
          className="aspect-square w-20 shrink-0 self-center mix-blend-multiply transition-transform duration-300 group-hover:scale-105 sm:w-28"
        />
      ) : (
        <span className="inline-flex size-20 shrink-0 items-center justify-center self-center rounded-pill bg-primary-50 text-primary-500">
          <SiteIcon name="tooth" className="size-9" />
        </span>
      )}
    </article>
  );
}
