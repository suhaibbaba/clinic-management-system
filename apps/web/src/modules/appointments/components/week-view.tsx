import {
  type CalendarAppointment,
  type ClinicClosure,
  type PersonName as PersonNameValue,
} from "@clinic/shared";
import { formatDate, formatWeekday } from "@web/shared/lib/format";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, Ltr, PersonName } from "@clinic/ui";
import { WEEK_FREE_GAP_MINUTES } from "@web/modules/appointments/constants";
import { instantAt, toIsoDate } from "@web/shared/lib/dates";
import { cn } from "@clinic/ui/lib/cn";
import { AppointmentLine } from "@web/modules/appointments/components/appointment-line";
import { IdleGap } from "@web/modules/appointments/components/idle-gap";
import { idleMinutesBefore, isReleased } from "@web/modules/appointments/lib/free-time";

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
    list.filter((appointment) => !isReleased(appointment)).length;

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
                      const idle = idleMinutesBefore(list, index);

                      return (
                        <li key={appointment.id} className="flex flex-col gap-1.5">
                          {idle >= WEEK_FREE_GAP_MINUTES && <IdleGap minutes={idle} />}
                          <AppointmentLine
                            data-testid={`${testId}-appointment-${appointment.id}`}
                            appointment={appointment}
                            onOpen={() => onOpen(appointment)}
                          />
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
