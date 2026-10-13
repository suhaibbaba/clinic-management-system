import type { JSX } from "react";
import { BottomCurve } from "@web/site/components/curves";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { Tagline } from "@web/site/components/tagline";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function StoryBanner(): JSX.Element {
  const { site, language, t } = useSite();
  const { about, story } = site.content;
  const subtitle = pick(about.cta.subtitle, language);

  return (
    <section
      data-testid="site-story-banner"
      aria-labelledby="story-banner-title"
      className="relative overflow-hidden bg-linear-to-l from-primary-800 via-primary-700 to-primary-500 text-ink-inverse"
    >
      <BottomCurve className="absolute inset-x-0 -top-px z-10 h-10 rotate-180 text-surface md:h-16" />
      <div className="grid items-stretch md:min-h-80 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div
          data-reveal
          className="site-gutter-start relative z-10 flex flex-col items-start justify-center gap-4 px-4 py-14 md:py-20 md:pe-8"
        >
          <SiteIcon name="sparkles" className="size-7 text-primary-200" />
          <h2 id="story-banner-title" className="text-title font-bold md:text-headline">
            {orDefault(about.cta.title, language, t("home.ctaTitle"))}
          </h2>
          <p className="text-section text-ink-inverse/85">{subtitle || t("home.ctaSubtitle")}</p>
          <PillLink
            to={SITE_PATH.BOOKING}
            tone="inverse"
            size="lg"
            className="mt-2"
            data-testid="site-story-banner-book"
          >
            {t("hero.cta")}
          </PillLink>
        </div>
        <div className="relative min-h-56">
          <SiteImage
            src={imageOf(site, story.image)}
            layer
            wash={false}
            className="site-fade-start opacity-90"
          />
          <Tagline tone="inverse" className="absolute end-6 bottom-16 hidden md:flex" />
        </div>
      </div>
      <BottomCurve className="absolute inset-x-0 -bottom-px z-10 h-8 text-primary-50 md:h-12" />
    </section>
  );
}
