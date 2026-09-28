import { LOOKUP_LIST, type CalendarAppointment, type ClinicClosure } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, EmptyState, Icon, PersonName, usePersonName } from "@clinic/ui";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { AppointmentLine } from "@web/modules/appointments/components/appointment-line";
import { IdleGap } from "@web/modules/appointments/components/idle-gap";
import { idleMinutesBefore, isReleased } from "@web/modules/appointments/lib/free-time";
import { WEEK_FREE_GAP_MINUTES } from "@web/modules/appointments/constants";

export interface AgendaListProps {
  readonly "data-testid"?: string | undefined;
  readonly appointments: readonly CalendarAppointment[];
  readonly closure?: ClinicClosure | undefined;
  readonly onOpen: (appointment: CalendarAppointment) => void;
}

export function AgendaList({
  appointments,
  closure,
  onOpen,
  "data-testid": testId = "agenda-list",
}: AgendaListProps): JSX.Element {
  const { t } = useTranslation();
  const doctorName = usePersonName();
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);

  const closedNotice = closure ? (
    <p
      data-testid={`${testId}-closure`}
      className="flex items-center gap-2 rounded-card bg-warning-50 px-3 py-2 text-label text-warning-800"
    >
      <Icon name="alert" />
      {t("appointments.grid.closedOn", { reason: closure.reason })}
    </p>
  ) : null;

  if (appointments.length === 0) {
    return (
      <div data-testid={testId} className="flex flex-col gap-3">
        {closedNotice}
        <EmptyState
          icon="calendar"
          data-testid={`${testId}-empty`}
          title="appointments.empty"
          hint="appointments.emptyHint"
        />
      </div>
    );
  }

  const ordered = [...appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const groups = new Map<string, CalendarAppointment[]>();

  for (const appointment of ordered) {
    groups.set(appointment.doctorId, [...(groups.get(appointment.doctorId) ?? []), appointment]);
  }

  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      {closedNotice}
      {[...groups.entries()].map(([doctorId, list]) => {
        const name = list[0]?.doctorName;

        return (
          <section
            key={doctorId}
            data-testid={`${testId}-doctor-${doctorId}`}
            aria-label={doctorName(name)}
            className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
          >
            <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              <Avatar name={doctorName(name)} tintKey={doctorId} size={26} />
              <PersonName name={name} className="truncate text-label font-medium text-ink" />
              <span className="ms-auto shrink-0 text-meta text-ink-muted">
                {t("pagination.total", {
                  total: list.filter((appointment) => !isReleased(appointment)).length,
                })}
              </span>
            </header>

            <ul className="flex flex-col gap-1.5 p-2">
              {list.map((appointment, index) => {
                const idle = idleMinutesBefore(list, index);

                return (
                  <li key={appointment.id} className="flex flex-col gap-1.5">
                    {idle >= WEEK_FREE_GAP_MINUTES && <IdleGap minutes={idle} />}
                    <AppointmentLine
                      data-testid={`${testId}-item-${appointment.id}`}
                      appointment={appointment}
                      onOpen={() => onOpen(appointment)}
                      trailing={typeLabel(appointment.type)}
                      target
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
