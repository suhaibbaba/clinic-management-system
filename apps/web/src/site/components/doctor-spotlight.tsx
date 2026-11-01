import type { PublicSite } from "@clinic/shared";
import type { JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { SiteLink } from "@web/site/components/site-link";
import { useSite } from "@web/site/hooks/use-site";
import { profileOf } from "@web/site/lib/doctors";
import { nameIn, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function DoctorSpotlight({
  doctor,
  onFocus,
}: {
  readonly doctor: PublicSite["doctors"][number];
  readonly onFocus: () => void;
}): JSX.Element {
  const { site, language, t } = useSite();
  const name = nameIn(doctor.name, language);
  const profile = profileOf(site, doctor.id);

  return (
    <SiteLink
      to={`${SITE_PATH.DOCTORS}/${doctor.id}`}
      onFocus={onFocus}
      data-testid={`site-doctor-tile-${doctor.id}`}
      className="group grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] overflow-hidden rounded-[1.75rem] border border-primary-100 bg-surface shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      <span className="relative min-h-48 bg-linear-to-b from-primary-100 to-primary-50 sm:min-h-64">
        <SiteImage
          src={doctor.photoUrl}
          fit="top"
          layer
          className="site-fade-end"
          fallback={<SiteIcon name="stethoscope" className="size-12" />}
        />
      </span>
      <span className="flex min-w-0 flex-col items-start justify-center gap-2 px-4 py-5 sm:gap-3 sm:px-6">
        <span className="text-heading font-bold text-primary-900 sm:text-title">{name}</span>
        <span className="text-label text-ink-muted sm:text-section">
          {(profile && pick(profile.title, language)) || doctor.specialty}
        </span>
        <span className="pill-text mt-1 inline-flex min-h-(--control-h-sm) whitespace-nowrap items-center gap-2 rounded-pill border border-primary-500 px-4 text-label font-bold text-primary-900 transition-colors group-hover:bg-primary-600 group-hover:text-ink-inverse sm:min-h-(--control-h) sm:px-5">
          {t("doctors.more")}
          <SiteIcon
            name="arrow-end"
            className="size-4 text-primary-600 group-hover:text-ink-inverse"
          />
        </span>
      </span>
    </SiteLink>
  );
}
