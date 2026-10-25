import type { SiteService } from "@clinic/shared";
import type { JSX } from "react";
import { CardFill } from "@web/site/components/card-fill";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { pick } from "@web/site/lib/text";

export function ServiceCard({ service }: { readonly service: SiteService }): JSX.Element {
  const { site, language } = useSite();
  const description = pick(service.description, language);

  return (
    <article
      data-testid={`site-service-${service.id}`}
      className="group relative isolate flex h-full min-h-44 items-stretch overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors duration-300 hover:border-primary-700"
    >
      <CardFill />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 p-5">
        <h3 className="site-fill-ink text-heading font-bold text-primary-900">
          {pick(service.title, language)}
        </h3>
        {description && <p className="site-fill-soft text-label text-ink-muted">{description}</p>}
      </div>
      <SiteImage
        src={imageOf(site, service.image)}
        className="w-2/5 shrink-0"
        fallback={<SiteIcon name="tooth" className="size-9" />}
      />
    </article>
  );
}
