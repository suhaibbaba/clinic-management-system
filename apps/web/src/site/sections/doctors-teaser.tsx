import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { Carousel } from "@web/site/components/carousel";
import { DoctorCard } from "@web/site/components/doctor-card";
import { PillLink } from "@web/site/components/pill-link";
import { SectionHeading } from "@web/site/components/section-heading";
import { HOME_DOCTORS } from "@web/site/constants";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { visibleDoctors } from "@web/site/lib/doctors";
import { orDefault } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function DoctorsTeaser(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { doctors: copy } = site.content;
  const doctors = visibleDoctors(site);
  const bookable = useBookable();

  if (!site.content.sections.includes(SITE_SECTION.DOCTORS) || doctors.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-doctors-teaser"
      className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14"
    >
      <SectionHeading
        id="doctors-teaser"
        align="center"
        eyebrow={orDefault(copy.title, language, t("doctors.title"))}
        title={orDefault(copy.subtitle, language, t("doctors.subtitle"))}
      />
      <Carousel
        label={t("nav.doctors")}
        grid="sm:grid sm:grid-cols-[repeat(auto-fit,minmax(15rem,18rem))] sm:justify-center sm:gap-5"
        data-testid="site-doctors-carousel"
      >
        {doctors.slice(0, HOME_DOCTORS).map((doctor) => (
          <DoctorCard key={doctor.id} doctor={doctor} bookable={bookable} />
        ))}
      </Carousel>
      <PillLink
        to={SITE_PATH.DOCTORS}
        tone="outline"
        className="self-center"
        data-testid="site-doctors-more"
      >
        {t("home.doctorsAll")}
      </PillLink>
    </section>
  );
}
