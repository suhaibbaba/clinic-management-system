import type { JSX, ReactNode } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { useHoursText } from "@web/site/hooks/use-hours-text";
import { useSite } from "@web/site/hooks/use-site";

function Item({
  icon,
  children,
}: {
  readonly icon: "map-pin" | "phone" | "clock";
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <li className="flex items-center gap-3">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-600">
        <SiteIcon name={icon} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col text-label text-ink-muted">{children}</span>
    </li>
  );
}

export function InfoStrip({ compact = false }: { readonly compact?: boolean }): JSX.Element {
  const { site, t } = useSite();
  const hours = useHoursText();
  const { clinic } = site;

  return (
    <ul
      data-testid="site-info-strip"
      className={
        compact
          ? "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-x-8"
          : "grid gap-5 sm:grid-cols-3"
      }
    >
      {clinic.address && (
        <Item icon="map-pin">
          <span className="text-ink">{clinic.address}</span>
        </Item>
      )}
      {clinic.phone && (
        <Item icon="phone">
          <a
            href={`tel:${clinic.phone}`}
            dir="ltr"
            className="w-fit text-ink hover:text-primary-700"
          >
            {clinic.phone}
          </a>
          <span>{t("home.contactNow")}</span>
        </Item>
      )}
      {hours && (
        <Item icon="clock">
          <span className="text-ink">{hours.days}</span>
          <span className="tabular-nums">{hours.time}</span>
        </Item>
      )}
    </ul>
  );
}
