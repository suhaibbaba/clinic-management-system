import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { HeroRibbon, HeroSwoosh, HeroWave } from "@web/site/components/curves";
import { Dots } from "@web/site/components/dots";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { HERO_FACES_MAX, HERO_SLIDE_MS } from "@web/site/constants";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { useSlides } from "@web/site/hooks/use-slides";
import { nameIn, orDefault, pick, heroLines } from "@web/site/lib/text";
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
  const [lead, accent] = heroLines(
    orDefault(hero.title, language, nameIn(site.clinic.name, language)),
  );
  const statLabel = pick(hero.stat.label, language);
  const faces = site.doctors.filter((doctor) => doctor.photoUrl !== null).slice(0, HERO_FACES_MAX);
  const showServices = site.content.sections.includes(SITE_SECTION.SERVICES);

  return (
    <section
      data-testid="site-page-hero-home"
      aria-labelledby="home-title"
      className="site-hero-wash relative overflow-hidden lg:mb-24 lg:overflow-visible"
    >
      <div aria-hidden className="absolute inset-0 hidden overflow-hidden lg:block">
        {slides.map((url, slide) => (
          <SiteImage
            key={url}
            src={url}
            layer
            wash={false}
            className={cx(
              "scale-110 blur-2xl transition-opacity duration-[1400ms] ease-in-out",
              slide === active ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        <span className="absolute inset-0 from-primary-50/85 via-surface/55 via-40% to-surface/10 ltr:bg-linear-to-r rtl:bg-linear-to-l" />
        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-surface/60 to-transparent" />
      </div>
      <HeroSwoosh className="absolute inset-y-0 start-0 hidden h-full w-1/2 opacity-80 lg:block" />
      <HeroWave className="absolute end-0 bottom-0 hidden h-40 w-[45%] lg:block" />
      <div className="relative flex flex-col lg:block lg:min-h-[30rem]">
        <div
          data-testid="site-page-hero-home-image"
          className="relative aspect-[4/3] lg:absolute lg:inset-y-0 lg:end-0 lg:aspect-auto lg:w-[54%]"
          onMouseEnter={() => hold(true)}
          onMouseLeave={() => hold(false)}
        >
          <div className="absolute inset-0 overflow-hidden lg:site-hero-arc">
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
                    "transition-[opacity,scale] duration-[1400ms] ease-in-out",
                    slide === active ? "scale-100 opacity-100" : "scale-105 opacity-0",
                  )}
                />
              ))
            )}
            <span
              aria-hidden
              className="absolute inset-0 hidden from-transparent from-55% to-surface/50 lg:block ltr:bg-linear-to-l rtl:bg-linear-to-r"
            />
          </div>
          <HeroRibbon className="absolute inset-0 hidden size-full overflow-visible lg:block" />
          {hero.stat.value && (
            <div
              data-testid="site-hero-stat"
              className="absolute end-4 bottom-4 flex flex-col items-center gap-0.5 rounded-t-[999px] rounded-b-card border border-surface/80 bg-surface/70 px-7 pt-5 pb-3 shadow-float backdrop-blur-md lg:start-[13%] lg:end-auto lg:bottom-24"
            >
              <bdi className="text-title font-bold text-primary-700">{hero.stat.value}</bdi>
              {statLabel && <span className="text-label text-ink-muted">{statLabel}</span>}
              {faces.length > 0 && (
                <span aria-hidden className="mt-2 flex items-center -space-x-2 rtl:space-x-reverse">
                  {faces.map((doctor) => (
                    <SiteImage
                      key={doctor.id}
                      src={doctor.photoUrl}
                      fit="top"
                      className="size-10 shrink-0 rounded-pill border-2 border-surface"
                    />
                  ))}
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-pill border-2 border-surface bg-primary-500 text-ink-inverse">
                    <SiteIcon name="plus" className="size-4" />
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-14 lg:pt-12 lg:pb-24">
          <div data-reveal className="flex flex-col items-start gap-5 lg:max-w-[26rem]">
            {eyebrow && (
              <p className="flex items-center gap-3 text-heading font-medium text-primary-600">
                <span aria-hidden className="h-px w-12 bg-primary-300" />
                {eyebrow}
              </p>
            )}
            <h1 id="home-title" className="text-headline font-bold text-primary-900 md:text-hero">
              {lead}
              {accent && <span className="block text-primary-600">{accent}</span>}
            </h1>
            <p className="text-heading text-ink-muted">
              {orDefault(hero.subtitle, language, t("hero.subtitle"))}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
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
                  <SiteIcon name="play" />
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
        </div>
      </div>

      {highlights.length > 0 && (
        <div className="relative z-10 mx-auto max-w-6xl px-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:translate-y-1/2">
          <ul
            data-testid="site-highlights"
            data-reveal-group
            className="grid grid-cols-1 gap-y-5 rounded-card border border-line/70 bg-surface p-5 shadow-float sm:grid-cols-2 md:p-7 lg:grid-cols-4 lg:divide-x lg:divide-line"
          >
            {highlights.map((feature, position) => {
              const text = pick(feature.text, language);

              return (
                <li key={position} className="flex items-center gap-4 lg:px-5">
                  <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-700">
                    <SiteIcon name={feature.icon} className="size-7" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
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
