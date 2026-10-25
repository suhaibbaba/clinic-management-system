import type { PublicSiteDoctor } from "@clinic/shared";
import type { JSX } from "react";
import { PillLink } from "@web/site/components/pill-link";
import { CardFill } from "@web/site/components/card-fill";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { SiteLink } from "@web/site/components/site-link";
import { SITE_PARAM } from "@web/site/constants";
import { useSite } from "@web/site/hooks/use-site";
import { profileOf } from "@web/site/lib/doctors";
import { nameIn, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function DoctorCard({
  doctor,
  bookable,
}: {
  readonly doctor: PublicSiteDoctor;
  readonly bookable: boolean;
}): JSX.Element {
  const { site, language, t } = useSite();
  const name = nameIn(doctor.name, language);
  const profile = profileOf(site, doctor.id);
  const title = (profile && pick(profile.title, language)) || doctor.specialty;
  const bio = profile ? pick(profile.bio, language) : "";
  const profilePath = `${SITE_PATH.DOCTORS}/${doctor.id}`;

  return (
    <article
      data-testid={`site-doctor-${doctor.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors duration-300 hover:border-primary-700"
    >
      <SiteLink to={profilePath} tabIndex={-1} aria-hidden>
        <SiteImage
          src={doctor.photoUrl}
          fit="top"
          className="aspect-[4/3.6] w-full"
          fallback={<SiteIcon name="stethoscope" className="size-12" />}
        />
      </SiteLink>
      <div className="relative isolate flex flex-1 flex-col items-center gap-1.5 p-4 text-center">
        <CardFill />
        <h3 className="site-fill-ink text-heading font-bold text-primary-900">{name}</h3>
        <p className="site-fill-soft text-label font-medium text-primary-600">{title}</p>
        {bio && <p className="site-fill-soft line-clamp-2 text-label text-ink-muted">{bio}</p>}
        <div className="mt-auto grid w-full grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2 pt-4">
          {bookable && (
            <PillLink
              to={SITE_PATH.BOOKING}
              params={{ [SITE_PARAM.DOCTOR]: doctor.id }}
              data-testid={`site-doctor-book-${doctor.id}`}
              className="gap-1.5 px-2 whitespace-nowrap"
            >
              {t("doctors.book")}
            </PillLink>
          )}
          <PillLink
            to={profilePath}
            tone="outline"
            arrow={false}
            data-testid={`site-doctor-profile-${doctor.id}`}
            className="px-2 whitespace-nowrap"
          >
            <span aria-hidden>{t("doctors.profile")}</span>
            <span className="sr-only">{t("doctors.profileOf", { name })}</span>
          </PillLink>
        </div>
      </div>
    </article>
  );
}
