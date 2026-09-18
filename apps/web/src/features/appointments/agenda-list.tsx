import { LOOKUP_LIST, type CalendarAppointment, type ClinicClosure } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, EmptyState, Icon, Ltr, PersonName } from "@clinic/ui";
import { useLookupLabels } from "@web/features/lookups/queries";
import { APPOINTMENT_STATUS_STYLES, statusLabelKey } from "@web/features/appointments/status";
import { minutesOf, toTimeLabel } from "@web/features/appointments/calendar-time";
import { cn } from "@clinic/ui/lib/cn";

export interface AgendaListProps {
  readonly "data-testid"?: string | undefined;
  readonly appointments: readonly CalendarAppointment[];
  /** The closure covering this day, if one does — the phone's version of the shading. */
  readonly closure?: ClinicClosure | undefined;
  readonly onOpen: (appointment: CalendarAppointment) => void;
  readonly showDoctor: boolean;
}

export function AgendaList({
  appointments,
  closure,
  onOpen,
  showDoctor,
  "data-testid": testId = "agenda-list",
}: AgendaListProps): JSX.Element {
  const { t } = useTranslation();
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

  return (
    <ul data-testid={testId} className="flex flex-col gap-3">
      {closedNotice && <li>{closedNotice}</li>}
      {ordered.map((appointment) => {
        const style = APPOINTMENT_STATUS_STYLES[appointment.status];

        return (
          <li key={appointment.id}>
            <button
              type="button"
              onClick={() => onOpen(appointment)}
              data-appointment={appointment.id}
              data-testid={`${testId}-item-${appointment.id}`}
              className={cn(
                "flex w-full cursor-pointer items-stretch gap-3 rounded-card border border-line bg-surface p-3",
                "text-start shadow-card transition-shadow duration-150 hover:shadow-float",
              )}
            >
              {/* The status stripe: the colour the grid uses, in the shape a
                  card can carry it. */}
              <span
                aria-hidden="true"
                className={cn("w-1 shrink-0 rounded-pill border-4", style.block)}
              />

              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <Ltr className="text-value font-medium tabular-nums text-ink">
                    {toTimeLabel(minutesOf(appointment.startsAt))}
                  </Ltr>
                  <Badge tone={style.tone} data-testid={`${testId}-status-${appointment.id}`}>
                    {t(statusLabelKey(appointment.status))}
                  </Badge>
                </span>

                <span className="truncate text-value font-medium text-ink">
                  {appointment.patientName}
                </span>

                <span className="flex flex-wrap items-center gap-x-2 text-label text-ink-muted">
                  <span>{typeLabel(appointment.type)}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("appointments.durationMinutes", { count: appointment.durationMinutes })}
                  </span>
                  {showDoctor && (
                    <>
                      <span aria-hidden="true">·</span>
                      <PersonName name={appointment.doctorName} className="truncate" />
                    </>
                  )}
                </span>
              </span>

              <Icon name="chevron-end" className="size-4 self-center text-ink-subtle" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
