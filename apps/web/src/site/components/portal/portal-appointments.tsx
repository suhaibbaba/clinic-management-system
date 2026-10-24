import type { PortalAppointment } from "@clinic/shared";
import type { JSX } from "react";
import { PortalPanel } from "@web/site/components/portal/portal-panel";
import { SiteIcon } from "@web/site/components/site-icon";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { nameIn } from "@web/site/lib/text";

export function PortalAppointments({
  title,
  empty,
  appointments,
  format,
  "data-testid": testId,
}: {
  readonly title: string;
  readonly empty: string;
  readonly appointments: readonly PortalAppointment[];
  readonly format: PortalFormat;
  readonly "data-testid": string;
}): JSX.Element {
  const { language, t } = useSite();

  return (
    <PortalPanel title={title} empty={empty} data-testid={testId}>
      {appointments.map((item) => (
        <li
          key={item.id}
          data-testid={`${testId}-${item.id}`}
          className="flex items-center gap-3 py-3"
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-600">
            <SiteIcon name="calendar" className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-value font-bold text-primary-900">
              {format.dateTime(item.startsAt)}
            </span>
            <span className="text-label text-ink-muted">{nameIn(item.doctor, language)}</span>
          </span>
          <span className="pill-text rounded-pill bg-primary-50 px-3 py-1 text-meta font-medium text-primary-800">
            {t(`portal.appointmentStatus.${item.status}`)}
          </span>
        </li>
      ))}
    </PortalPanel>
  );
}
