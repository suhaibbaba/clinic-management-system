import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { PillLink } from "@web/site/components/pill-link";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
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
        <span className="truncate text-label font-bold text-primary-900">{children}</span>
        <span className="text-meta text-ink-muted">{label}</span>
      </span>
    </>
  );
  const className =
    "flex min-w-0 items-center gap-3 rounded-pill bg-surface py-2 ps-2 pe-5 shadow-float";

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
  const image = imageOf(site, cta.image);

  return (
    <section
      data-testid="site-booking-band"
      aria-labelledby="booking-band-title"
      className="relative isolate overflow-hidden"
    >
      {image && (
        <SiteImage
          src={image}
          layer
          data-testid="site-booking-band-image"
          className="hidden lg:block lg:end-auto lg:w-[30%]"
        />
      )}
      <div
        className={cx(
          "site-band-wash relative grid overflow-hidden text-ink-inverse",
          "md:grid-cols-[auto_minmax(0,1fr)_12rem] lg:grid-cols-[auto_minmax(0,1fr)_16rem]",
          image && "lg:ms-[24%] lg:rounded-s-[8rem_50%]",
        )}
      >
        <SiteIcon
          name="sparkles"
          className="pointer-events-none absolute -top-6 end-[30%] size-40 text-ink-inverse/5"
        />
        <div className="relative flex min-w-0 flex-col justify-center gap-3 px-5 pt-8 md:w-80 md:py-12 md:ps-8 md:pe-2 lg:ps-0">
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
        <div
          data-reveal
          className="relative order-first flex flex-col items-center gap-2 px-5 pt-12 text-center md:order-none md:py-12"
        >
          <h2 id="booking-band-title" className="text-title font-bold md:text-headline">
            {orDefault(cta.title, language, t("home.ctaTitle"))}
          </h2>
          <p className="max-w-md text-section text-ink-inverse/85">
            {pick(cta.subtitle, language) || t("home.ctaSubtitle")}
          </p>
          {bookable && (
            <PillLink
              to={SITE_PATH.BOOKING}
              tone="outline-inverse"
              size="lg"
              className="mt-4"
              data-testid="site-booking-band-book"
            >
              <SiteIcon name="calendar" />
              {t("hero.cta")}
            </PillLink>
          )}
        </div>
        <div aria-hidden className="relative hidden items-center justify-center py-8 md:flex">
          <span className="absolute inset-y-6 aspect-square rounded-pill bg-ink-inverse/10 blur-2xl" />
          <SiteIcon
            name="tooth"
            className="relative size-40 -rotate-12 fill-ink-inverse stroke-primary-100 drop-shadow-2xl lg:size-48"
          />
        </div>
        <span aria-hidden className="pb-10 md:hidden" />
      </div>
    </section>
  );
}
