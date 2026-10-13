import type { JSX } from "react";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { Tagline } from "@web/site/components/tagline";
import { SITE_PATH } from "@web/site/route";

export function Promo({
  title,
  image,
  cta,
  testId,
}: {
  readonly title: string;
  readonly image: string | undefined;
  readonly cta: string;
  readonly testId: string;
}): JSX.Element {
  return (
    <div
      data-testid={testId}
      data-reveal
      className="site-panel-wash relative grid items-stretch overflow-hidden rounded-card shadow-card md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
    >
      <div className="relative min-h-56">
        <SiteImage src={image} layer className="site-fade-end" />
        <Tagline className="absolute start-6 top-6 hidden md:flex" />
      </div>
      <div className="relative flex flex-col items-start justify-center gap-5 p-6 md:p-10">
        <SiteIcon name="sparkles" className="size-7 text-primary-500" />
        <p className="text-title font-bold text-primary-900 md:text-headline">{title}</p>
        <PillLink to={SITE_PATH.BOOKING} size="lg" data-testid={`${testId}-book`}>
          {cta}
        </PillLink>
      </div>
    </div>
  );
}
