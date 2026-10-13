import type { JSX } from "react";
import { AccentRule } from "@web/site/components/accent-rule";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { SiteLink } from "@web/site/components/site-link";
import { SITE_PARAM } from "@web/site/constants";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { profileOf, visibleDoctors } from "@web/site/lib/doctors";
import { nameIn, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function DoctorPage({ id }: { readonly id: string }): JSX.Element {
  const { site, language, t } = useSite();
  const doctor = visibleDoctors(site).find((candidate) => candidate.id === id);
  const bookable = useBookable();

  if (!doctor) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-title font-bold text-primary-900">{t("doctors.notFound")}</h1>
        <PillLink to={SITE_PATH.DOCTORS}>{t("doctors.back")}</PillLink>
      </div>
    );
  }

  const name = nameIn(doctor.name, language);
  const profile = profileOf(site, doctor.id);
  const bio = profile ? pick(profile.bio, language) : "";

  return (
    <section data-testid="site-doctor-page" aria-labelledby="doctor-title" className="site-wash">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-14 md:grid-cols-[20rem_minmax(0,1fr)]">
        <SiteImage
          src={doctor.photoUrl}
          fit="top"
          priority
          className="site-shape-soft aspect-[4/5] w-full border-4 border-surface shadow-float"
          fallback={<SiteIcon name="stethoscope" className="size-16" />}
        />
        <div className="flex flex-col items-start gap-3">
          <SiteLink
            to={SITE_PATH.DOCTORS}
            className="inline-flex items-center gap-1.5 text-label font-medium text-primary-700 hover:text-primary-900"
          >
            <SiteIcon name="chevron-start" className="size-4" />
            {t("doctors.back")}
          </SiteLink>
          <h1 id="doctor-title" className="text-headline font-bold text-primary-900 md:text-hero">
            {name}
          </h1>
          <p className="text-heading font-medium text-primary-600">
            {(profile && pick(profile.title, language)) || doctor.specialty}
          </p>
          <AccentRule />
          {bio && <p className="text-section whitespace-pre-line text-ink-muted">{bio}</p>}
          {bookable && (
            <PillLink
              to={SITE_PATH.BOOKING}
              params={{ [SITE_PARAM.DOCTOR]: doctor.id }}
              size="lg"
              className="mt-3"
              data-testid="site-doctor-page-book"
            >
              {t("doctors.bookWith", { name })}
            </PillLink>
          )}
        </div>
      </div>
    </section>
  );
}
