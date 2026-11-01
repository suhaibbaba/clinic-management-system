import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { Dots } from "@web/site/components/dots";
import { HeroProof } from "@web/site/components/hero-proof";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { SiteLink } from "@web/site/components/site-link";
import { WaveDivider } from "@web/site/components/wave-divider";
import { HERO_SLIDE_MS } from "@web/site/constants";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { useSlides } from "@web/site/hooks/use-slides";
import { nameIn, orDefault, pick, titleLines } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

const ACTION =
  "pill-text group/pill inline-flex min-h-(--control-h) w-full items-center justify-center gap-3 rounded-pill px-6 text-heading font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:w-auto sm:min-w-72";

export function HeroSection(): JSX.Element {
  const { site, language, t } = useSite();
  const { hero, highlights } = site.content;
  const slides = hero.images
    .map((key) => site.images[key])
    .filter((url): url is string => url !== undefined);
  const { active, playing, show, hold } = useSlides(slides.length);
  const bookable = useBookable();
  const eyebrow = pick(site.content.brand.tagline, language);
  const [lead, accent] = titleLines(
    orDefault(hero.title, language, nameIn(site.clinic.name, language)),
  );
  const showServices = site.content.sections.includes(SITE_SECTION.SERVICES);

  return (
    <>
      <section
        data-testid="site-page-hero-home"
        aria-labelledby="home-title"
        className="site-hero-wash relative isolate overflow-hidden"
      >
        <div
          data-testid="site-page-hero-home-image"
          className="site-fade-end absolute inset-y-0 start-0 -z-10 w-[52%] md:w-1/2"
          onMouseEnter={() => hold(true)}
          onMouseLeave={() => hold(false)}
        >
          {slides.length === 0 ? (
            <SiteImage src={null} layer fallback={<SiteIcon name="smile" className="size-16" />} />
          ) : (
            slides.map((url, slide) => (
              <SiteImage
                key={url}
                src={url}
                priority={slide === 0}
                layer
                fit="top"
                data-testid={`site-hero-image-${slide + 1}`}
                className={cx(
                  "transition-opacity duration-1000 ease-in-out",
                  slide === active ? "opacity-100" : "opacity-0",
                )}
              />
            ))
          )}
          <Dots
            count={slides.length}
            active={active}
            onSelect={show}
            label={t("hero.slides")}
            itemLabel={(slide) => t("hero.slide", { number: slide + 1 })}
            duration={playing ? HERO_SLIDE_MS : undefined}
            className="absolute start-3 bottom-16 rounded-pill bg-surface/70 px-1 backdrop-blur sm:bottom-24"
            data-testid="site-hero-dots"
          />
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,44fr)_minmax(0,56fr)] md:grid-cols-2">
          <div
            data-reveal
            className="col-start-2 flex flex-col items-start gap-3 py-8 pe-4 sm:gap-5 sm:py-14 md:py-20 lg:pe-4"
          >
            {eyebrow && (
              <p className="flex items-center gap-2 text-label font-bold text-primary-600 sm:text-section">
                {eyebrow}
                <span aria-hidden className="h-0.5 w-6 rounded-pill bg-primary-900 sm:w-10" />
              </p>
            )}
            <h1 id="home-title" className="text-headline font-bold text-primary-900 sm:text-hero">
              {lead}
              {accent && <span className="block text-primary-600">{accent}</span>}
            </h1>
            <p className="max-w-md text-label text-ink-muted sm:text-section">
              {orDefault(hero.subtitle, language, t("hero.subtitle"))}
            </p>
            <HeroProof />
          </div>
        </div>

        <WaveDivider
          fills={["fill-primary-200/60", "fill-primary-100", "fill-surface"]}
          className="-mt-6 sm:-mt-10"
        />
      </section>

      {(bookable || showServices) && (
        <div
          data-testid="site-hero-actions"
          data-reveal
          className="relative mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 pb-4 sm:flex-row sm:gap-4"
        >
          {bookable && (
            <SiteLink
              to={SITE_PATH.BOOKING}
              data-testid="site-hero-book"
              className={cx(
                ACTION,
                "bg-linear-to-l from-primary-600 to-primary-800 text-ink-inverse shadow-nav-active hover:brightness-105",
              )}
            >
              <SiteIcon name="calendar" className="size-6" />
              {t("hero.cta")}
              <SiteIcon
                name="arrow-end"
                className="size-5 transition-transform group-hover/pill:-translate-x-0.5 ltr:group-hover/pill:translate-x-0.5"
              />
            </SiteLink>
          )}
          {showServices && (
            <SiteLink
              to={SITE_PATH.SERVICES}
              data-testid="site-hero-services"
              className={cx(
                ACTION,
                "border border-primary-500 bg-primary-50 text-primary-900 hover:bg-primary-100",
              )}
            >
              <SiteIcon name="play-circle" className="size-6 text-primary-600" />
              {t("hero.services")}
            </SiteLink>
          )}
        </div>
      )}

      {highlights.length > 0 && (
        <section aria-label={t("home.highlightsLabel")} className="relative">
          <ul
            data-testid="site-highlights"
            data-reveal-group
            className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 py-6 sm:gap-5 lg:grid-cols-4"
          >
            {highlights.map((feature, position) => {
              const text = pick(feature.text, language);

              return (
                <li
                  key={position}
                  className="flex flex-col items-center gap-2 rounded-[1.75rem] border border-primary-100 bg-linear-to-b from-surface to-primary-50 px-3 py-5 text-center shadow-card sm:gap-3 sm:px-5 sm:py-7"
                >
                  <span className="inline-flex size-14 items-center justify-center rounded-pill bg-primary-100 text-primary-600 sm:size-16">
                    <SiteIcon name={feature.icon} className="size-7 sm:size-8" />
                  </span>
                  <h2 className="text-section font-bold text-primary-900 sm:text-heading">
                    {pick(feature.label, language)}
                  </h2>
                  {text && <p className="text-meta text-ink-muted sm:text-label">{text}</p>}
                </li>
              );
            })}
          </ul>
          <WaveDivider fills={["fill-primary-100/70", "fill-primary-100", "fill-primary-50"]} />
        </section>
      )}
    </>
  );
}
