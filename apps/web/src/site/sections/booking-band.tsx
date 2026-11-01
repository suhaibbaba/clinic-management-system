import type { JSX, ReactNode } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteLink } from "@web/site/components/site-link";
import { WaveDivider } from "@web/site/components/wave-divider";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { mapsLink, orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

function ContactCard({
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
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-pill bg-primary-100 text-primary-600">
        <SiteIcon name={icon} className="size-6" />
      </span>
      <span className="flex min-w-0 flex-col items-center gap-0.5">
        <span className="text-label font-bold whitespace-pre-line text-primary-900 sm:text-section">
          {children}
        </span>
        <span className="text-label text-ink-muted">{label}</span>
      </span>
    </>
  );
  const className =
    "flex h-full min-w-0 flex-col items-center gap-2 rounded-[1.5rem] bg-surface px-3 py-5 text-center shadow-float sm:px-5";

  return href ? (
    <a
      href={href}
      data-testid={testId}
      className={`${className} hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-inverse`}
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
  const cards = [clinic.phone, clinic.address].filter(Boolean).length;

  return (
    <section
      data-testid="site-booking-band"
      aria-labelledby="booking-band-title"
      className="site-band-wash relative isolate overflow-hidden text-ink-inverse"
    >
      <WaveDivider
        flip
        fills={["fill-primary-50/35", "fill-primary-50/60", "fill-primary-50"]}
        className="-mb-px"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pt-4 pb-6 text-center">
        <div data-reveal className="flex flex-col items-center gap-3">
          <h2 id="booking-band-title" className="text-headline font-bold sm:text-hero">
            {orDefault(cta.title, language, t("home.ctaTitle"))}
          </h2>
          <p className="max-w-lg text-section text-ink-inverse/90 sm:text-heading">
            {pick(cta.subtitle, language) || t("home.ctaSubtitle")}
          </p>
        </div>
        {bookable && (
          <SiteLink
            to={SITE_PATH.BOOKING}
            data-testid="site-booking-band-book"
            className="pill-text group/pill mt-2 inline-flex min-h-(--control-h) w-full max-w-xs items-center justify-center gap-3 rounded-pill bg-surface px-8 text-heading font-bold text-primary-900 shadow-float hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-inverse"
          >
            <SiteIcon name="calendar" className="size-6 text-primary-600" />
            {t("home.ctaBook")}
            <SiteIcon
              name="arrow-end"
              className="size-5 text-primary-600 transition-transform group-hover/pill:-translate-x-0.5 ltr:group-hover/pill:translate-x-0.5"
            />
          </SiteLink>
        )}
        {cards > 0 && (
          <div
            data-reveal-group
            className={
              cards === 2
                ? "mt-4 grid w-full grid-cols-1 items-stretch gap-3 min-[24rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-5"
                : "mt-4 flex w-full max-w-sm justify-center"
            }
          >
            {clinic.phone && (
              <ContactCard
                icon="phone"
                href={`tel:${clinic.phone}`}
                label={t("home.contactNow")}
                data-testid="site-booking-band-phone"
              >
                <bdi dir="ltr" className="text-section tabular-nums sm:text-heading">
                  {clinic.phone}
                </bdi>
              </ContactCard>
            )}
            {cards === 2 && (
              <span
                aria-hidden
                className="hidden w-px self-center bg-ink-inverse/50 min-[24rem]:block min-[24rem]:h-12"
              />
            )}
            {clinic.address && (
              <ContactCard
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
              </ContactCard>
            )}
          </div>
        )}
      </div>
      <WaveDivider fills={["fill-surface/25", "fill-surface/55", "fill-primary-50"]} />
    </section>
  );
}
