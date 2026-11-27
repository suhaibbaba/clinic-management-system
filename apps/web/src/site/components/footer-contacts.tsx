import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import { useHoursText } from "@web/site/hooks/use-hours-text";
import { useSite } from "@web/site/hooks/use-site";
import { mapsLink, phoneLabel, pick } from "@web/site/lib/text";

const FILLED = {
  phone: "fill-current stroke-none",
  mail: "",
  "map-pin": "fill-current [&>circle]:fill-primary-600 [&>circle]:stroke-primary-600",
  clock: "",
} as const;

function FooterContact({
  icon,
  href,
  external = false,
  children,
  className,
  "data-testid": testId,
}: {
  readonly icon: keyof typeof FILLED;
  readonly href?: string | null;
  readonly external?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
  readonly "data-testid": string;
}): JSX.Element {
  const row = "flex min-w-0 items-center gap-5 text-field sm:text-heading lg:gap-3 lg:text-value";
  const body = (
    <>
      <span className="site-footer-tile inline-flex size-10 shrink-0 items-center justify-center rounded-control lg:size-8">
        <SiteIcon name={icon} className={cx("size-5 lg:size-4", FILLED[icon])} />
      </span>
      <span className="min-w-0 wrap-anywhere">{children}</span>
    </>
  );

  return (
    <li data-testid={testId} className={cx("min-w-0 lg:px-4 xl:px-6", className)}>
      {href ? (
        <a
          href={href}
          className={cx(row, "hover:text-primary-200")}
          {...(external && { target: "_blank", rel: "noreferrer noopener" })}
        >
          {body}
        </a>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

export function FooterContacts({ className }: { readonly className?: string }): JSX.Element | null {
  const { site, language, languages, t } = useSite();
  const { clinic } = site;
  const address = pick(clinic.address, language, languages);
  const hours = useHoursText();

  if (!clinic.phone && !clinic.email && !address && !hours) {
    return null;
  }

  return (
    <ul
      data-testid="site-footer-contacts"
      className={cx(
        "flex min-w-0 flex-col gap-3 lg:grid lg:grid-cols-[auto_auto_auto] lg:grid-rows-2 lg:content-center lg:justify-around lg:gap-0",
        className,
      )}
    >
      {clinic.phone && (
        <FooterContact
          icon="phone"
          href={`tel:${clinic.phone}`}
          className="lg:col-start-3 lg:row-start-1 lg:self-end lg:border-s lg:border-ink-inverse/30 lg:pb-1.5"
          data-testid="site-footer-phone"
        >
          <bdi dir="ltr" className="tabular-nums lg:whitespace-nowrap">
            {phoneLabel(clinic.phone)}
          </bdi>
        </FooterContact>
      )}
      {clinic.email && (
        <FooterContact
          icon="mail"
          href={`mailto:${clinic.email}`}
          className="lg:col-start-3 lg:row-start-2 lg:self-start lg:border-s lg:border-ink-inverse/30 lg:pt-1.5"
          data-testid="site-footer-email"
        >
          <bdi dir="ltr" className="lg:whitespace-nowrap">
            {clinic.email}
          </bdi>
        </FooterContact>
      )}
      {address && (
        <FooterContact
          icon="map-pin"
          href={
            clinic.latitude !== null && clinic.longitude !== null
              ? mapsLink(clinic.latitude, clinic.longitude)
              : null
          }
          external
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center lg:border-s lg:border-ink-inverse/30"
          data-testid="site-footer-address"
        >
          {address}
        </FooterContact>
      )}
      {hours && (
        <FooterContact
          icon="clock"
          className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-center"
          data-testid="site-footer-hours"
        >
          <span className="block font-bold">{t("footer.hours")}</span>
          <span className="block text-value sm:text-field lg:text-label lg:whitespace-nowrap">
            {hours.days}
            <span className="lg:hidden">: </span>
            <bdi className="inline-block tabular-nums lg:block">{hours.time}</bdi>
          </span>
        </FooterContact>
      )}
    </ul>
  );
}
