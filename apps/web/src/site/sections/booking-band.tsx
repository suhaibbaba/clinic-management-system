import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { PillLink } from "@web/site/components/pill-link";
import { BandWave } from "@web/site/components/curves";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { useSiteGlyph } from "@web/site/hooks/use-site-glyph";
import { imageOf } from "@web/site/lib/images";
import { mapsLink, orDefault, pick } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

function ContactChip({
  icon,
  href,
  label,
  children,
  external = false,
  long = false,
  "data-testid": testId,
}: {
  readonly icon: "phone" | "map-pin";
  readonly href: string | null;
  readonly label: string;
  readonly children: ReactNode;
  readonly external?: boolean;
  readonly long?: boolean;
  readonly "data-testid": string;
}): JSX.Element {
  const body = (
    <>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-600 md:size-12 md:bg-primary-600 md:text-ink-inverse md:shadow-float">
        <SiteIcon name={icon} className="size-5" />
      </span>
      <span className="flex w-full min-w-0 flex-col md:w-auto">
        <span
          className={cx(
            "font-bold wrap-anywhere text-primary-900",
            long ? "text-meta" : "truncate text-label md:text-section",
          )}
        >
          {children}
        </span>
        <span className="text-meta text-ink-muted">{label}</span>
      </span>
    </>
  );
  const className =
    "flex min-w-0 flex-col items-center gap-2 rounded-card bg-surface p-3 text-center shadow-float md:flex-row md:gap-3 md:rounded-[2.25rem] md:py-2.5 md:ps-2.5 md:pe-6 md:text-start";

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
  const { site, language, languages, t } = useSite();
  const glyph = useSiteGlyph();
  const { clinic } = site;
  const { cta } = site.content.about;
  const bookable = useBookable();
  const image = imageOf(site, cta.image);
  const address = pick(clinic.address, language, languages);

  return (
    <section
      data-testid="site-booking-band"
      aria-labelledby="booking-band-title"
      className="relative isolate overflow-hidden from-surface from-50% to-primary-50 to-50% max-md:bg-linear-to-b md:bg-primary-50"
    >
      {image && (
        <div className="site-band-photo absolute inset-y-0 start-0 hidden w-[42%] lg:block">
          <SiteImage src={image} layer data-testid="site-booking-band-image" />
        </div>
      )}
      <div
        className={cx(
          "relative overflow-hidden max-md:site-wave-both md:site-wave-bottom from-primary-900 via-primary-700 via-55% to-primary-500 text-ink-inverse ltr:bg-linear-to-l rtl:bg-linear-to-r",
          image && "lg:ms-[22%] lg:rounded-s-[14rem]",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 start-1/4 size-[28rem] rounded-pill bg-primary-300/25 blur-3xl"
        />
        <BandWave className="pointer-events-none absolute inset-x-0 bottom-10 hidden h-24 w-full text-ink-inverse/10 md:block" />
        <div className="relative grid pt-6 pb-20 md:pt-0 md:pb-16 md:grid-cols-[auto_minmax(0,1fr)_14rem] lg:grid-cols-[auto_minmax(0,1fr)_17rem]">
          <div className="relative grid min-w-0 auto-cols-fr grid-flow-col gap-3 px-5 pt-8 md:flex md:w-80 md:flex-col md:justify-center md:gap-4 md:py-12 md:ps-10 md:pe-2 lg:w-96 lg:ps-16">
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
            {address && (
              <ContactChip
                icon="map-pin"
                href={
                  clinic.latitude !== null && clinic.longitude !== null
                    ? mapsLink(clinic.latitude, clinic.longitude)
                    : null
                }
                external
                long
                label={t("contact.address")}
                data-testid="site-booking-band-address"
              >
                {address}
              </ContactChip>
            )}
          </div>
          <div className="relative order-first flex flex-col items-center gap-3 px-5 pt-12 text-center md:order-none md:py-12">
            <h2 id="booking-band-title" className="text-title font-bold md:text-headline">
              {orDefault(cta.title, language, t("home.ctaTitle"), languages)}
            </h2>
            <p className="max-w-md text-heading text-ink-inverse/90">
              {pick(cta.subtitle, language, languages) || t("home.ctaSubtitle")}
            </p>
            {bookable && (
              <PillLink
                to={SITE_PATH.BOOKING}
                tone="outline-inverse"
                size="lg"
                className="mt-3"
                data-testid="site-booking-band-book"
              >
                <SiteIcon name="calendar" />
                {t("hero.cta")}
              </PillLink>
            )}
          </div>
          <div aria-hidden className="relative hidden items-center justify-center py-8 md:flex">
            <span className="absolute size-44 rounded-pill border border-ink-inverse/30 bg-radial from-ink-inverse/5 via-ink-inverse/10 to-ink-inverse/25 shadow-glass lg:size-48" />
            <span className="absolute h-10 w-60 translate-y-14 -rotate-12 rounded-pill border-2 border-ink-inverse/40 blur-[1px]" />
            <SiteIcon
              name={glyph}
              className="relative size-32 -rotate-6 fill-ink-inverse stroke-primary-100 drop-shadow-2xl lg:size-36"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
