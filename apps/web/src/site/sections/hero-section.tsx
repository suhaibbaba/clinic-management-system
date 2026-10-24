import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { Dots } from "@web/site/components/dots";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { HERO_SLIDE_MS } from "@web/site/constants";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { useSlides } from "@web/site/hooks/use-slides";
import { nameIn, orDefault, pick, titleLines } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function HeroSection(): JSX.Element {
  const { site, language, t } = useSite();
  const { hero, story, highlights } = site.content;
  const slides = hero.images
    .map((key) => site.images[key])
    .filter((url): url is string => url !== undefined);
  const { active, playing, show, hold } = useSlides(slides.length);
  const bookable = useBookable();
  const eyebrow = pick(story.eyebrow, language);
  const [lead, accent] = titleLines(
    orDefault(hero.title, language, nameIn(site.clinic.name, language)),
  );
  const statLabel = pick(hero.stat.label, language);
  const showServices = site.content.sections.includes(SITE_SECTION.SERVICES);

  return (
    <section
      data-testid="site-page-hero-home"
      aria-labelledby="home-title"
      className="site-hero-wash relative"
    >
      <div className="grid items-center md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div
          data-reveal
          className="site-gutter-start order-2 flex flex-col items-start gap-5 px-4 pt-8 pb-14 md:order-1 md:py-20 md:pe-10"
        >
          {eyebrow && (
            <p className="flex items-center gap-3 text-section font-medium text-primary-600">
              <span aria-hidden className="h-px w-8 bg-primary-300" />
              {eyebrow}
            </p>
          )}
          <h1 id="home-title" className="text-headline font-bold text-primary-900 md:text-hero">
            {lead}
            {accent && <span className="block text-primary-600">{accent}</span>}
          </h1>
          <p className="max-w-lg text-section text-ink-muted">
            {orDefault(hero.subtitle, language, t("hero.subtitle"))}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {bookable && (
              <PillLink to={SITE_PATH.BOOKING} size="lg" tone="dark" data-testid="site-hero-book">
                <SiteIcon name="calendar" />
                {t("hero.cta")}
              </PillLink>
            )}
            {showServices && (
              <PillLink
                to={SITE_PATH.SERVICES}
                size="lg"
                tone="outline"
                arrow={false}
                data-testid="site-hero-services"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-pill bg-primary-900 text-ink-inverse">
                  <SiteIcon name="chevron-end" className="size-4" />
                </span>
                {t("hero.services")}
              </PillLink>
            )}
          </div>
          <Dots
            count={slides.length}
            active={active}
            onSelect={show}
            label={t("hero.slides")}
            itemLabel={(slide) => t("hero.slide", { number: slide + 1 })}
            duration={playing ? HERO_SLIDE_MS : undefined}
            className="-ms-2"
            data-testid="site-hero-dots"
          />
        </div>

        <div
          data-testid="site-page-hero-home-image"
          className="relative order-1 aspect-[4/3] md:order-2 md:aspect-auto md:h-full md:min-h-[36rem]"
          onMouseEnter={() => hold(true)}
          onMouseLeave={() => hold(false)}
        >
          <span
            aria-hidden
            className="site-arc-start absolute inset-y-6 -start-4 end-0 hidden border-2 border-primary-100 md:block"
          />
          <div className="absolute inset-0 overflow-hidden md:site-arc-start">
            {slides.length === 0 ? (
              <SiteImage
                src={null}
                layer
                fallback={<SiteIcon name="sparkles" className="size-16" />}
              />
            ) : (
              slides.map((url, slide) => (
                <SiteImage
                  key={url}
                  src={url}
                  priority={slide === 0}
                  layer
                  data-testid={`site-hero-image-${slide + 1}`}
                  className={cx(
                    "transition-opacity duration-1000 ease-in-out",
                    slide === active ? "opacity-100" : "opacity-0",
                  )}
                />
              ))
            )}
          </div>
          {hero.stat.value && (
            <div
              data-testid="site-hero-stat"
              className="absolute end-4 bottom-4 flex flex-col rounded-card bg-surface/90 px-4 py-3 shadow-float backdrop-blur md:end-8 md:bottom-16"
            >
              <bdi className="text-heading font-bold text-primary-700">{hero.stat.value}</bdi>
              {statLabel && <span className="text-label text-ink-muted">{statLabel}</span>}
            </div>
          )}
        </div>
      </div>

      {highlights.length > 0 && (
        <div className="relative z-10 mx-auto max-w-6xl px-4 md:-mt-12">
          <ul
            data-testid="site-highlights"
            data-reveal-group
            className="grid grid-cols-1 gap-y-5 rounded-card border border-line/70 bg-surface p-5 shadow-card sm:grid-cols-2 md:p-6 lg:grid-cols-4 lg:divide-x lg:divide-line"
          >
            {highlights.map((feature, position) => {
              const text = pick(feature.text, language);

              return (
                <li key={position} className="flex items-center gap-3 lg:px-5">
                  <SiteIcon name={feature.icon} className="size-10 text-primary-600" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-section font-bold text-primary-900">
                      {pick(feature.label, language)}
                    </span>
                    {text && <span className="text-label text-ink-muted">{text}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
