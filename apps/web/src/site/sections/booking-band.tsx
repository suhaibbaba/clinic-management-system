import type { JSX, ReactNode } from "react";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { mapsLink, orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

function ContactChip({
  icon,
  href,
  label,
  children,
  external = false,
  "data-testid": testId,
}: {
  readonly icon: "phone" | "map-pin";
  readonly href: string | null;
  readonly label: string;
  readonly children: ReactNode;
  readonly external?: boolean;
  readonly "data-testid": string;
}): JSX.Element {
  const body = (
    <>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-700">
        <SiteIcon name={icon} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-section font-bold text-primary-900">{children}</span>
        <span className="text-meta text-ink-muted">{label}</span>
      </span>
    </>
  );
  const className =
    "flex min-w-0 items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-float sm:min-w-56";

  return href ? (
    <a
      href={href}
      data-testid={testId}
      className={`${className} hover:bg-primary-50`}
      {...(external && { target: "_blank", rel: "noreferrer noopener" })}
    >
      {body}
    </a>
  ) : (
    <div data-testid={testId} className={className}>
      {body}
    </div>
  );
}

export function BookingBand(): JSX.Element {
  const { site, language, t } = useSite();
  const { clinic } = site;
  const { cta } = site.content.about;
  const bookable = useBookable();

  return (
    <section
      data-testid="site-booking-band"
      aria-labelledby="booking-band-title"
      className="site-band-wash relative mt-6 overflow-hidden rounded-t-[3rem] text-ink-inverse"
    >
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:flex-row md:items-center">
        <SiteIcon
          name="tooth"
          className="pointer-events-none absolute -bottom-10 start-[38%] hidden size-56 text-ink-inverse/10 md:block"
        />
        <div data-reveal className="relative flex flex-1 flex-col items-start gap-2">
          <h2 id="booking-band-title" className="text-title font-bold md:text-headline">
            {orDefault(cta.title, language, t("home.ctaTitle"))}
          </h2>
          <p className="max-w-md text-section text-ink-inverse/85">
            {pick(cta.subtitle, language) || t("home.ctaSubtitle")}
          </p>
          {bookable && (
            <PillLink
              to={SITE_PATH.BOOKING}
              tone="inverse"
              className="mt-3"
              data-testid="site-booking-band-book"
            >
              {t("hero.cta")}
            </PillLink>
          )}
        </div>
        <div className="relative flex flex-col gap-3 sm:flex-row">
          {clinic.phone && (
            <ContactChip
              icon="phone"
              href={`tel:${clinic.phone}`}
              label={t("home.callNow")}
              data-testid="site-booking-band-phone"
            >
              <bdi dir="ltr">{clinic.phone}</bdi>
            </ContactChip>
          )}
          {clinic.address && (
            <ContactChip
              icon="map-pin"
              href={
                clinic.latitude !== null && clinic.longitude !== null
                  ? mapsLink(clinic.latitude, clinic.longitude)
                  : null
              }
              external
              label={t("contact.address")}
              data-testid="site-booking-band-address"
            >
              {clinic.address}
            </ContactChip>
          )}
        </div>
      </div>
    </section>
  );
}
