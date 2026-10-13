import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { Dots } from "@web/site/components/dots";
import { PageHero } from "@web/site/components/page-hero";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { HERO_SLIDE_MS } from "@web/site/constants";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { useSlides } from "@web/site/hooks/use-slides";
import { nameIn, orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function HeroSection(): JSX.Element {
  const { site, language, t } = useSite();
  const { hero, story, highlights } = site.content;
  const slides = hero.images
    .map((key) => site.images[key])
    .filter((url): url is string => url !== undefined);
  const { active, playing, show, hold } = useSlides(slides.length);
  const bookable = useBookable();
  const avatars = site.doctors.filter((doctor) => doctor.photoUrl).slice(0, 3);
  const statLabel = pick(hero.stat.label, language);

  return (
    <PageHero
      id="home"
      tall
      eyebrow={pick(story.eyebrow, language)}
      title={orDefault(hero.title, language, nameIn(site.clinic.name, language))}
      intro={orDefault(hero.subtitle, language, t("hero.subtitle"))}
      media={
        <div
          className="absolute inset-0"
          onMouseEnter={() => hold(true)}
          onMouseLeave={() => hold(false)}
        >
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
      }
      overlay={
        hero.stat.value && (
          <div
            data-testid="site-hero-stat"
            className="absolute end-4 bottom-12 hidden items-center gap-3 rounded-card border border-line/60 bg-surface/90 px-4 py-3 shadow-float backdrop-blur sm:flex md:end-10 md:bottom-24"
          >
            {avatars.length > 0 && (
              <span className="flex -space-x-3 rtl:space-x-reverse">
                {avatars.map((doctor) => (
                  <img
                    key={doctor.id}
                    src={doctor.photoUrl ?? undefined}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 rounded-pill border-2 border-surface object-cover object-top"
                  />
                ))}
              </span>
            )}
            <span className="flex flex-col">
              <bdi className="text-heading font-bold text-primary-700">{hero.stat.value}</bdi>
              {statLabel && <span className="text-label text-ink-muted">{statLabel}</span>}
            </span>
          </div>
        )
      }
    >
      {bookable && (
        <PillLink to={SITE_PATH.BOOKING} size="lg" className="mt-2" data-testid="site-hero-book">
          {t("hero.cta")}
        </PillLink>
      )}

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

      {highlights.length > 0 && (
        <ul data-testid="site-highlights" className="mt-4 flex flex-wrap gap-2">
          {highlights.map((feature, position) => (
            <li
              key={position}
              className="pill-text inline-flex min-h-(--control-h-sm) items-center gap-2 rounded-pill border border-primary-100 bg-primary-50 px-3 text-label font-medium text-primary-800"
            >
              <SiteIcon name={feature.icon} className="size-4 text-primary-600" />
              {pick(feature.label, language)}
            </li>
          ))}
        </ul>
      )}
    </PageHero>
  );
}
