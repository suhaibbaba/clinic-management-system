import type { SiteService } from "@clinic/shared";
import type { JSX } from "react";
import { CardFill } from "@web/site/components/card-fill";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { useSite } from "@web/site/hooks/use-site";
import { useSiteGlyph } from "@web/site/hooks/use-site-glyph";
import { imageOf } from "@web/site/lib/images";
import { pick } from "@web/site/lib/text";

export function ServiceCard({ service }: { readonly service: SiteService }): JSX.Element {
  const { site, language, languages } = useSite();
  const glyph = useSiteGlyph();
  const description = pick(service.description, language, languages);

  return (
    <article
      data-testid={`site-service-${service.id}`}
      className="group relative isolate flex h-full min-h-44 flex-col-reverse items-stretch overflow-hidden sm:flex-row rounded-card border border-line bg-surface shadow-card shadow-primary-600/55 transition-[border-color,box-shadow] duration-300 hover:border-primary-700 hover:shadow-card-hover hover:shadow-primary-600/70"
    >
      <CardFill />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 p-5">
        <h3 className="site-fill-ink text-heading font-bold text-primary-900">
          {pick(service.title, language, languages)}
        </h3>
        {description && <p className="site-fill-soft text-label text-ink-muted">{description}</p>}
      </div>
      <SiteImage
        src={imageOf(site, service.image)}
        className="aspect-[16/10] w-full shrink-0 sm:aspect-auto sm:w-2/5"
        fallback={<SiteIcon name={glyph} className="size-9" />}
      />
    </article>
  );
}
