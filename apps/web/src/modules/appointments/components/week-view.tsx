import {
  APPOINTMENT_STATUS,
  type CalendarAppointment,
  type ClinicClosure,
  type PersonName as PersonNameValue,
} from "@clinic/shared";
import { formatDate, formatTime, formatWeekday } from "@web/shared/lib/format";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, Ltr, PersonName } from "@clinic/ui";
import { APPOINTMENT_STATUS_STYLES } from "@web/shared/lib/appointment-status";
import { WEEK_FREE_GAP_MINUTES } from "@web/modules/appointments/constants";
import { instantAt, toIsoDate } from "@web/shared/lib/dates";
import { cn } from "@clinic/ui/lib/cn";
import { formatDuration } from "@web/shared/lib/duration";

export interface WeekViewDoctor {
  readonly id: string;
  readonly name: PersonNameValue;
}

export interface WeekViewProps {
  readonly "data-testid"?: string | undefined;
  readonly days: readonly string[];
  readonly today: string;
  readonly doctors: readonly WeekViewDoctor[];
  readonly appointments: readonly CalendarAppointment[];
  readonly closures?: readonly ClinicClosure[] | undefined;
  readonly onOpen: (appointment: CalendarAppointment) => void;
  readonly onPickDay: (date: string) => void;
}

const endOf = (appointment: CalendarAppointment): number =>
  Date.parse(appointment.startsAt) + appointment.durationMinutes * 60_000;

const released = (appointment: CalendarAppointment): boolean =>
  appointment.status === APPOINTMENT_STATUS.CANCELLED ||
  appointment.status === APPOINTMENT_STATUS.NO_SHOW;

export function WeekView({
  days,
  today,
  doctors,
  appointments,
  closures = [],
  onOpen,
  onPickDay,
  "data-testid": testId = "week-view",
}: WeekViewProps): JSX.Element {
  const { t } = useTranslation();

  const dayOf = (appointment: CalendarAppointment): string =>
    toIsoDate(new Date(appointment.startsAt));
  const closureOn = (day: string): ClinicClosure | undefined =>
    closures.find((closure) => closure.startsOn <= day && day <= closure.endsOn);
  const booked = (list: readonly CalendarAppointment[]): number =>
    list.filter((appointment) => !released(appointment)).length;

  const rows = doctors.filter(
    (doctor) =>
      doctors.length === 1 ||
      appointments.some((appointment) => appointment.doctorId === doctor.id),
  );
  if (rows.length === 0 && closures.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        data-testid={`${testId}-empty`}
        title="appointments.emptyWeek"
        hint="appointments.emptyHint"
      />
    );
  }

  const columns = { gridTemplateColumns: `11rem repeat(${days.length}, minmax(10rem, 1fr))` };

  return (
    <div
      data-testid={testId}
      className="overflow-x-auto rounded-card border border-line bg-surface shadow-card"
    >
      <div className="grid min-w-max" style={columns}>
        <span className="border-b border-line" aria-hidden="true" />
        {days.map((day) => {
          const closure = closureOn(day);

          return (
            <button
              key={day}
              type="button"
              data-testid={`${testId}-pick-${day}`}
              onClick={() => onPickDay(day)}
              className={cn(
                "cursor-pointer border-s border-b border-line px-3 py-2.5 text-start",
                "transition-colors duration-150 hover:bg-row-hover",
                closure ? "bg-warning-50" : day === today && "bg-primary-50",
              )}
            >
              <span
                className={cn(
                  "block text-label font-medium",
                  day === today ? "text-primary-700" : "text-ink",
                )}
              >
                {formatWeekday(instantAt(day, 12 * 60))}
              </span>
              <span className="flex items-center justify-between gap-2 text-meta text-ink-muted">
                <Ltr>{formatDate(day)}</Ltr>
                <span className="truncate">
                  {closure
                    ? closure.reason
                    : t("pagination.total", {
                        total: booked(appointments.filter((entry) => dayOf(entry) === day)),
                      })}
                </span>
              </span>
            </button>
          );
        })}

        {rows.map((doctor) => {
          const own = appointments.filter((appointment) => appointment.doctorId === doctor.id);

          return (
            <div key={doctor.id} className="contents" data-testid={`${testId}-doctor-${doctor.id}`}>
              <div className="sticky start-0 z-10 flex flex-col gap-0.5 border-b border-line bg-surface px-3 py-2.5">
                <PersonName
                  name={doctor.name}
                  className="truncate text-label font-medium text-ink"
                />
                <span className="text-meta text-ink-muted">
                  {t("pagination.total", { total: booked(own) })}
                </span>
              </div>

              {days.map((day) => {
                const closed = closureOn(day) !== undefined;
                const list = own
                  .filter((appointment) => dayOf(appointment) === day)
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

                return (
                  <ul
                    key={day}
                    data-testid={`${testId}-cell-${doctor.id}-${day}`}
                    className={cn(
                      "flex flex-col gap-1.5 border-s border-b border-line p-2",
                      closed && "bg-sunken",
                    )}
                  >
                    {list.length === 0 && (
                      <li aria-hidden="true" className="px-2 py-1 text-meta text-ink-muted">
                        —
                      </li>
                    )}
                    {list.map((appointment, index) => {
                      const previous = list
                        .slice(0, index)
                        .filter((entry) => !released(entry))
                        .at(-1);
                      const free =
                        previous && !released(appointment)
                          ? Math.round(
                              (Date.parse(appointment.startsAt) - endOf(previous)) / 60_000,
                            )
                          : 0;

                      return (
                        <li key={appointment.id} className="flex flex-col gap-1.5">
                          {free >= WEEK_FREE_GAP_MINUTES && (
                            <span
                              data-part="free"
                              className="flex items-center gap-2 px-1 text-micro text-ink-muted"
                            >
                              <span
                                aria-hidden="true"
                                className="h-px flex-1 border-t border-dashed border-line-strong"
                              />
                              {t("appointments.freeGap", { duration: formatDuration(t, free) })}
                              <span
                                aria-hidden="true"
                                className="h-px flex-1 border-t border-dashed border-line-strong"
                              />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpen(appointment)}
                            data-appointment={appointment.id}
                            data-testid={`${testId}-appointment-${appointment.id}`}
                            aria-label={`${formatTime(appointment.startsAt)} — ${
                              appointment.patientName
                            } — ${t(`appointments.statuses.${appointment.status}`)}`}
                            className={cn(
                              "flex w-full cursor-pointer items-baseline gap-2 rounded-panel border px-2.5 py-1.5 text-start text-meta",
                              "transition-shadow duration-150 hover:shadow-card",
                              APPOINTMENT_STATUS_STYLES[appointment.status].block,
                            )}
                          >
                            <Ltr className="shrink-0 font-medium tabular-nums">
                              {formatTime(appointment.startsAt)}
                            </Ltr>
                            <span className="truncate">{appointment.patientName}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
