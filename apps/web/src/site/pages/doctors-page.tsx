import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { Carousel } from "@web/site/components/carousel";
import { DoctorCard } from "@web/site/components/doctor-card";
import { PageHero } from "@web/site/components/page-hero";
import { SiteIcon } from "@web/site/components/site-icon";
import { SITE_PARAM } from "@web/site/constants";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { visibleDoctors } from "@web/site/lib/doctors";
import { orDefault, pick } from "@web/site/lib/text";

export function DoctorsPage(): JSX.Element {
  const { site, language, t, params, setParams } = useSite();
  const { doctors: copy } = site.content;
  const doctors = visibleDoctors(site);
  const specialties = [...new Set(doctors.map((doctor) => doctor.specialty))];
  const chosen = params.get(SITE_PARAM.SPECIALTY);
  const specialty = chosen !== null && specialties.includes(chosen) ? chosen : null;
  const shown = specialty ? doctors.filter((doctor) => doctor.specialty === specialty) : doctors;
  const bookable = useBookable();

  return (
    <>
      <PageHero
        id="doctors"
        title={orDefault(copy.title, language, t("doctors.title"))}
        subtitle={orDefault(copy.subtitle, language, t("doctors.subtitle"))}
        image={imageOf(site, copy.image)}
      >
        {copy.features.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
            {copy.features.map((feature, position) => (
              <li key={position} className="flex flex-col items-center gap-2 text-center">
                <SiteIcon name={feature.icon} className="size-8 text-primary-600" />
                <span className="text-label font-medium text-primary-900">
                  {pick(feature.label, language)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PageHero>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12">
        {specialties.length > 1 && (
          <div
            role="group"
            aria-label={t("doctors.filter")}
            data-testid="site-doctors-filter"
            className="flex flex-wrap gap-2"
          >
            {[null, ...specialties].map((option) => (
              <button
                key={option ?? "all"}
                type="button"
                aria-pressed={option === specialty}
                data-testid={`site-doctors-filter-${option ?? "all"}`}
                onClick={() => setParams({ [SITE_PARAM.SPECIALTY]: option })}
                className={cx(
                  "pill-text inline-flex min-h-(--control-h) min-w-32 cursor-pointer items-center justify-center rounded-pill border px-6 text-label font-medium transition-colors",
                  option === specialty
                    ? "border-primary-600 bg-primary-600 text-ink-inverse shadow-nav-active"
                    : "border-line bg-surface text-ink-muted shadow-pill hover:border-primary-300 hover:text-primary-700",
                )}
              >
                {option ?? t("doctors.all")}
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="text-center text-value text-ink-muted">{t("doctors.empty")}</p>
        ) : (
          <Carousel
            label={t("nav.doctors")}
            grid="sm:grid sm:grid-cols-[repeat(auto-fit,minmax(15rem,18rem))] sm:justify-center sm:gap-5"
            data-testid="site-doctors"
          >
            {shown.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} bookable={bookable} />
            ))}
          </Carousel>
        )}
      </div>
    </>
  );
}
