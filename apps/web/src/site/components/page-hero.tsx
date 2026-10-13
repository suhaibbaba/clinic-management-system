import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { AccentRule } from "@web/site/components/accent-rule";
import { BottomCurve, SideCurve } from "@web/site/components/curves";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { Tagline } from "@web/site/components/tagline";

export function PageHero({
  id,
  eyebrow,
  title,
  subtitle,
  intro,
  image,
  media,
  overlay,
  tagline = false,
  tall = false,
  children,
}: {
  readonly id: string;
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly intro?: string | undefined;
  readonly image?: string | undefined;
  readonly media?: ReactNode;
  readonly overlay?: ReactNode;
  readonly tagline?: boolean;
  readonly tall?: boolean;
  readonly children?: ReactNode;
}): JSX.Element {
  return (
    <section
      data-testid={`site-page-hero-${id}`}
      aria-labelledby={`${id}-title`}
      className="relative overflow-hidden bg-surface"
    >
      <div
        data-testid={`site-page-hero-${id}-image`}
        className="relative aspect-[4/3] w-full sm:aspect-[16/9] md:absolute md:inset-y-0 md:end-0 md:aspect-auto md:w-[60%]"
      >
        {media ?? (
          <SiteImage
            src={image}
            priority
            layer
            fallback={<SiteIcon name="sparkles" className="size-16" />}
          />
        )}
        <SideCurve className="absolute inset-y-0 -start-px hidden h-full w-[26%] md:block" />
        <BottomCurve className="absolute inset-x-0 -bottom-px h-10 text-surface md:h-20" />
        {overlay}
      </div>

      <div
        className={cx(
          "relative mx-auto flex max-w-6xl px-4",
          tall ? "md:min-h-[40rem]" : "md:min-h-[32rem]",
        )}
      >
        <div
          data-reveal
          className="flex flex-col items-start gap-4 pb-10 md:w-[44%] md:justify-center md:py-20"
        >
          {eyebrow && <p className="text-heading font-medium text-primary-600">{eyebrow}</p>}
          <h1 id={`${id}-title`} className="text-headline font-bold text-primary-900 md:text-hero">
            {title}
          </h1>
          {subtitle && <p className="text-title font-medium text-primary-800">{subtitle}</p>}
          {intro && <p className="max-w-lg text-section text-ink-muted">{intro}</p>}
          <AccentRule className="mt-1" />
          {tagline && <Tagline />}
          {children}
        </div>
      </div>
    </section>
  );
}
