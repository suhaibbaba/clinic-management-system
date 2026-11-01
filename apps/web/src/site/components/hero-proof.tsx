import type { JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { HERO_PROOF_FACES } from "@web/site/constants";
import { useSite } from "@web/site/hooks/use-site";
import { initialOf, pick } from "@web/site/lib/text";

export function HeroProof(): JSX.Element | null {
  const { site, language } = useSite();
  const { stat } = site.content.hero;
  const label = pick(stat.label, language);
  const faces = site.content.testimonials.items
    .slice(0, HERO_PROOF_FACES)
    .map((item) => initialOf(item.name));

  if (!stat.value) {
    return null;
  }

  return (
    <div
      data-testid="site-hero-stat"
      className="mt-1 flex items-center gap-3 rounded-pill border border-surface/80 bg-surface/75 py-2 ps-4 pe-2 shadow-float backdrop-blur-md sm:mt-3 sm:gap-4 sm:ps-6"
    >
      <span className="flex flex-col">
        <bdi dir="ltr" className="text-heading font-bold text-primary-900 sm:text-title">
          {stat.value}
        </bdi>
        {label && (
          <span className="text-meta whitespace-nowrap text-ink-muted sm:text-label">{label}</span>
        )}
      </span>
      <span aria-hidden className="flex items-center -space-x-2 rtl:space-x-reverse">
        {faces.map((initial, position) => (
          <span
            key={position}
            className="inline-flex size-7 items-center justify-center rounded-pill border-2 border-surface bg-primary-200 max-[24rem]:hidden text-micro font-bold text-primary-900 sm:size-8 sm:text-meta"
          >
            {initial}
          </span>
        ))}
        <span className="inline-flex size-7 items-center justify-center rounded-pill border-2 border-surface bg-primary-600 text-ink-inverse sm:size-9">
          <SiteIcon name="plus" className="size-4" />
        </span>
      </span>
    </div>
  );
}
