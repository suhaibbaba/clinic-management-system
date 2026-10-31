import type { JSX, ReactNode } from "react";
import { AccentRule } from "@web/site/components/accent-rule";
import { HeroRibbon, HeroSwoosh } from "@web/site/components/curves";
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
  tagline = false,
  children,
}: {
  readonly id: string;
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly intro?: string | undefined;
  readonly image?: string | undefined;
  readonly tagline?: boolean;
  readonly children?: ReactNode;
}): JSX.Element {
  return (
    <section
      data-testid={`site-page-hero-${id}`}
      aria-labelledby={`${id}-title`}
      className="site-hero-wash relative overflow-hidden"
    >
      <div aria-hidden className="absolute inset-0 hidden overflow-hidden lg:block">
        <span className="absolute -top-40 start-[6%] size-[36rem] rounded-pill bg-primary-50/70 blur-3xl" />
        <span className="absolute -bottom-48 start-[34%] size-[32rem] rounded-pill bg-primary-50/30 blur-3xl" />
      </div>
      <HeroSwoosh className="absolute inset-y-0 start-0 hidden h-full w-1/2 opacity-80 lg:block" />
      <div className="relative flex flex-col lg:block lg:min-h-[30rem]">
        <div
          data-testid={`site-page-hero-${id}-image`}
          className="relative aspect-[4/3] sm:aspect-[16/9] lg:absolute lg:inset-y-0 lg:end-0 lg:aspect-auto lg:w-[50%]"
        >
          <div className="absolute inset-0 overflow-hidden lg:site-hero-arc">
            <SiteImage
              src={image}
              priority
              layer
              fallback={<SiteIcon name="sparkles" className="size-16" />}
            />
            <span
              aria-hidden
              className="absolute inset-0 hidden from-transparent from-55% to-surface/50 lg:block ltr:bg-linear-to-l rtl:bg-linear-to-r"
            />
          </div>
          <HeroRibbon className="absolute inset-0 hidden size-full overflow-visible lg:block" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-12 lg:py-16">
          <div data-reveal className="flex flex-col items-start gap-4 lg:max-w-[30rem]">
            {eyebrow && (
              <p className="flex items-center gap-3 text-heading font-medium text-primary-600">
                <span aria-hidden className="h-px w-12 bg-primary-300" />
                {eyebrow}
              </p>
            )}
            <h1
              id={`${id}-title`}
              className="text-headline font-bold text-primary-900 md:text-hero"
            >
              {title}
            </h1>
            {subtitle && <p className="text-title font-medium text-primary-800">{subtitle}</p>}
            {intro && <p className="text-section text-ink-muted">{intro}</p>}
            <AccentRule className="mt-1" />
            {tagline && <Tagline />}
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
