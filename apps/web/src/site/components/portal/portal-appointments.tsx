import type { PortalAppointment } from "@clinic/shared";
import type { JSX } from "react";
import { PortalDateBlock } from "@web/site/components/portal/portal-date-block";
import { PortalPanel } from "@web/site/components/portal/portal-panel";
import { PortalStatusPill } from "@web/site/components/portal/portal-status-pill";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { appointmentTone } from "@web/site/lib/portal";
import { nameIn } from "@web/site/lib/text";

export function PortalAppointments({
  title,
  empty,
  appointments,
  format,
  paged = false,
  "data-testid": testId,
}: {
  readonly title: string;
  readonly empty: string;
  readonly appointments: readonly PortalAppointment[];
  readonly format: PortalFormat;
  readonly paged?: boolean;
  readonly "data-testid": string;
}): JSX.Element {
  const { language, languages, t } = useSite();

  return (
    <PortalPanel
      title={title}
      empty={empty}
      icon="calendar-clock"
      paged={paged}
      data-testid={testId}
    >
      {appointments.map((item) => {
        const tone = appointmentTone(item.status);

        return (
          <li
            key={item.id}
            data-testid={`${testId}-${item.id}`}
            className="flex items-center gap-4 py-3.5"
          >
            <PortalDateBlock
              iso={item.startsAt}
              parts={format.dateParts(item.startsAt)}
              muted={tone !== "primary"}
            />
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <bdi className="text-value font-bold text-primary-900">
                {format.time(item.startsAt)}
              </bdi>
              <span className="text-label text-ink-muted">
                {nameIn(item.doctor, language, languages)}
              </span>
            </span>
            <PortalStatusPill tone={tone}>
              {t(`portal.appointmentStatus.${item.status}`)}
            </PortalStatusPill>
          </li>
        );
      })}
    </PortalPanel>
  );
}
