import type { JSX, ReactNode } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { useHoursText } from "@web/site/hooks/use-hours-text";
import { useSite } from "@web/site/hooks/use-site";
import { mapsLink } from "@web/site/lib/text";

function ContactCard({
  icon,
  title,
  children,
  testId,
}: {
  readonly icon: "map-pin" | "phone" | "mail";
  readonly title: string;
  readonly children: ReactNode;
  readonly testId: string;
}): JSX.Element {
  return (
    <li
      data-testid={testId}
      className="flex min-w-0 flex-col items-center gap-2 rounded-card border border-line bg-surface p-6 text-center shadow-card transition-shadow hover:shadow-card-hover"
    >
      <span className="mb-2 inline-flex size-14 items-center justify-center rounded-pill bg-primary-600 text-ink-inverse shadow-nav-active">
        <SiteIcon name={icon} className="size-6" />
      </span>
      <h3 className="text-heading font-bold text-primary-900">{title}</h3>
      <div className="flex max-w-full min-w-0 flex-col items-center gap-1 text-label text-ink-muted">
        {children}
      </div>
    </li>
  );
}

export function ContactCards(): JSX.Element {
  const { site, t } = useSite();
  const { clinic } = site;
  const hours = useHoursText();
  const pin =
    clinic.latitude !== null && clinic.longitude !== null
      ? mapsLink(clinic.latitude, clinic.longitude)
      : null;

  return (
    <ul
      data-testid="site-contact-cards"
      data-reveal-group
      className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {clinic.address && (
        <ContactCard icon="map-pin" title={t("contact.address")} testId="site-contact-address">
          <span className="max-w-full text-ink wrap-anywhere">{clinic.address}</span>
          {pin && (
            <a
              href={pin}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1.5 font-medium text-primary-700 hover:text-primary-900"
            >
              {t("contact.onMap")}
              <SiteIcon name="arrow-end" className="size-4" />
            </a>
          )}
        </ContactCard>
      )}
      {clinic.phone && (
        <ContactCard icon="phone" title={t("contact.phone")} testId="site-contact-phone">
          <a
            href={`tel:${clinic.phone}`}
            dir="ltr"
            className="max-w-full text-heading font-bold text-primary-900 wrap-anywhere hover:text-primary-700"
          >
            {clinic.phone}
          </a>
          {hours && (
            <>
              <bdi className="tabular-nums">{hours.time}</bdi>
              <span>{hours.days}</span>
            </>
          )}
        </ContactCard>
      )}
      {clinic.email && (
        <ContactCard icon="mail" title={t("contact.email")} testId="site-contact-email">
          <a
            href={`mailto:${clinic.email}`}
            dir="ltr"
            className="max-w-full font-medium text-primary-700 wrap-anywhere hover:text-primary-900"
          >
            {clinic.email}
          </a>
          <span>{t("contact.emailNote")}</span>
        </ContactCard>
      )}
    </ul>
  );
}
