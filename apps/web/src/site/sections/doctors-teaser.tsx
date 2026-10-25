import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { PillLink } from "@web/site/components/pill-link";
import { ShowcaseHeading } from "@web/site/components/showcase-heading";
import { CardFill } from "@web/site/components/card-fill";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { SiteLink } from "@web/site/components/site-link";
import { Slider } from "@web/site/components/slider";
import { useSite } from "@web/site/hooks/use-site";
import { profileOf, visibleDoctors } from "@web/site/lib/doctors";
import { nameIn, orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function DoctorsTeaser(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { doctors: copy } = site.content;
  const doctors = visibleDoctors(site);

  if (!site.content.sections.includes(SITE_SECTION.DOCTORS) || doctors.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-doctors-teaser"
      aria-labelledby="doctors-teaser-title"
      className="bg-primary-50/60"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14">
        <ShowcaseHeading
          id="doctors-teaser"
          title={orDefault(copy.title, language, t("doctors.title"))}
          subtitle={orDefault(copy.subtitle, language, t("doctors.subtitle"))}
          action={
            <PillLink to={SITE_PATH.DOCTORS} tone="outline" data-testid="site-doctors-more">
              {t("home.doctorsAll")}
            </PillLink>
          }
        />
        <Slider
          label={t("nav.doctors")}
          item="w-[72%] sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]"
          data-testid="site-doctors-carousel"
        >
          {doctors.map((doctor) => {
            const name = nameIn(doctor.name, language);
            const profile = profileOf(site, doctor.id);

            return (
              <SiteLink
                key={doctor.id}
                to={`${SITE_PATH.DOCTORS}/${doctor.id}`}
                data-testid={`site-doctor-tile-${doctor.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors duration-300 hover:border-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                <SiteImage
                  src={doctor.photoUrl}
                  fit="top"
                  className="aspect-[4/3.4] w-full"
                  fallback={<SiteIcon name="stethoscope" className="size-12" />}
                />
                <span className="relative isolate flex flex-1 items-start gap-2 p-4">
                  <CardFill />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="site-fill-ink text-section font-bold text-primary-900">
                      {name}
                    </span>
                    <span className="site-fill-soft text-label text-ink-muted">
                      {(profile && pick(profile.title, language)) || doctor.specialty}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill border border-line text-primary-700 group-hover:border-ink-inverse/40 group-hover:bg-surface"
                  >
                    <SiteIcon name="arrow-end" className="size-4" />
                  </span>
                </span>
              </SiteLink>
            );
          })}
        </Slider>
      </div>
    </section>
  );
}
