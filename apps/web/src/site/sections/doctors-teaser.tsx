import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { DoctorSpotlight } from "@web/site/components/doctor-spotlight";
import { Dots } from "@web/site/components/dots";
import { PillLink } from "@web/site/components/pill-link";
import { ShowcaseHeading } from "@web/site/components/showcase-heading";
import { SiteIcon } from "@web/site/components/site-icon";
import { useCenteredCarousel } from "@web/site/hooks/use-centered-carousel";
import { useSite } from "@web/site/hooks/use-site";
import { firstCentered } from "@web/site/lib/carousel";
import { visibleDoctors } from "@web/site/lib/doctors";
import { orDefault } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function DoctorsTeaser(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { doctors: copy } = site.content;
  const doctors = visibleDoctors(site);
  const { list, active, center } = useCenteredCarousel(
    doctors.length,
    firstCentered(doctors.length),
  );

  if (!site.content.sections.includes(SITE_SECTION.DOCTORS) || doctors.length === 0) {
    return null;
  }

  const arrow = (direction: -1 | 1): JSX.Element => (
    <button
      type="button"
      data-testid={`site-doctors-carousel-${direction === 1 ? "next" : "previous"}`}
      aria-label={t(direction === 1 ? "carousel.next" : "carousel.previous")}
      aria-controls="site-doctors-carousel-list"
      aria-disabled={active + direction < 0 || active + direction >= doctors.length}
      onClick={() => {
        const next = active + direction;

        if (next >= 0 && next < doctors.length) {
          center(next);
        }
      }}
      className={cx(
        "absolute top-1/2 z-10 hidden size-(--control-h) -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill border border-primary-100 bg-surface text-primary-800 shadow-float hover:bg-primary-50 aria-disabled:cursor-default aria-disabled:opacity-40 md:inline-flex",
        direction === 1 ? "end-4 lg:end-8" : "start-4 lg:start-8",
      )}
    >
      <SiteIcon name={direction === 1 ? "chevron-end" : "chevron-start"} />
    </button>
  );

  return (
    <section
      data-testid="site-doctors-teaser"
      aria-labelledby="doctors-teaser-title"
      className="bg-linear-to-b from-surface to-primary-50 py-14"
    >
      <div className="mx-auto max-w-6xl px-4">
        <ShowcaseHeading
          id="doctors-teaser"
          title={orDefault(copy.title, language, t("doctors.title"))}
          subtitle={orDefault(copy.subtitle, language, t("doctors.subtitle"))}
        />
      </div>
      <div data-testid="site-doctors-carousel" className="relative mt-8">
        {doctors.length > 1 && arrow(-1)}
        <ul
          ref={list}
          id="site-doctors-carousel-list"
          aria-label={t("nav.doctors")}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-[9vw] pt-1 pb-4 [scrollbar-width:none] sm:px-[17vw] lg:px-[calc(50vw-min(21rem,24vw))] [&::-webkit-scrollbar]:hidden"
        >
          {doctors.map((doctor, index) => (
            <li
              key={doctor.id}
              aria-label={t("carousel.item", { number: index + 1, total: doctors.length })}
              className="w-[82vw] shrink-0 snap-center sm:w-[66vw] lg:w-[min(42rem,48vw)]"
            >
              <DoctorSpotlight doctor={doctor} onFocus={() => center(index)} />
            </li>
          ))}
        </ul>
        {doctors.length > 1 && arrow(1)}
      </div>
      <div className="mt-2 flex flex-col items-center gap-4 px-4">
        <Dots
          count={doctors.length}
          active={active}
          onSelect={(index) => center(index)}
          label={t("nav.doctors")}
          itemLabel={(index) => t("carousel.item", { number: index + 1, total: doctors.length })}
          data-testid="site-doctors-dots"
        />
        <PillLink to={SITE_PATH.DOCTORS} tone="outline" data-testid="site-doctors-more">
          {t("home.doctorsAll")}
        </PillLink>
      </div>
    </section>
  );
}
