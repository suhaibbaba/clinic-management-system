import { LOOKUP_LIST, type CalendarAppointment, type ClinicClosure } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, Ltr } from '@web/components/ui';
import { useLookupLabels } from '@web/features/lookups/queries';
import { APPOINTMENT_STATUS_STYLES } from '@web/features/appointments/status';
import {
  minutesOf,
  toIsoDate,
  toTimeLabel,
  weekDates,
} from '@web/features/appointments/calendar-time';
import { cn } from '@web/lib/cn';
import { formatDate } from '@web/lib/format';

export interface WeekViewProps {
  readonly date: string;
  readonly appointments: readonly CalendarAppointment[];
  /** Closures overlapping the week; a covered day is shaded and named. */
  readonly closures?: readonly ClinicClosure[] | undefined;
  readonly onOpen: (appointment: CalendarAppointment) => void;
  readonly onPickDay: (date: string) => void;
}

// Not a time grid: a week at that scale is 10,500 pixels of empty column, and the question is "how
// full is Thursday?". Desktop only — seven 40px columns is unreadable.
export function WeekView({
  date,
  appointments,
  closures = [],
  onOpen,
  onPickDay,
}: WeekViewProps): JSX.Element {
  const { t } = useTranslation();
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);
  const days = weekDates(date);
  const today = toIsoDate(new Date());

  /** The closure covering a day, if one does. Both ends are inclusive. */
  const closureOn = (day: string): ClinicClosure | undefined =>
    closures.find((closure) => closure.startsOn <= day && day <= closure.endsOn);

  // A week with a closure in it is worth drawing even with nothing booked —
  // "why is Tuesday grey" is the question this view exists to answer.
  if (appointments.length === 0 && closures.length === 0) {
    return (
      <EmptyState icon="calendar" title="appointments.emptyWeek" hint="appointments.emptyHint" />
    );
  }

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card">
      <div className="grid min-w-max grid-cols-7 divide-x divide-line rtl:divide-x-reverse">
        {days.map((day) => {
          const ofDay = appointments
            .filter((entry) => toIsoDate(new Date(entry.startsAt)) === day)
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

          const closure = closureOn(day);

          return (
            <div key={day} className={cn('min-w-40 flex-1', closure && 'bg-sunken')}>
              <button
                type="button"
                onClick={() => onPickDay(day)}
                className={cn(
                  'block w-full cursor-pointer border-b border-line px-3 py-2.5 text-center',
                  'transition-colors duration-150 hover:bg-row-hover',
                  closure ? 'bg-warning-50' : day === today && 'bg-primary-50',
                )}
              >
                <span
                  className={cn(
                    'block text-label font-semibold',
                    day === today ? 'text-primary-700' : 'text-ink',
                  )}
                >
                  {formatDate(day)}
                </span>
                {/* The reason, not the word "closed": a clinic writes what it
                    wants reception to read out. */}
                <span className="block truncate text-[11px] text-ink-subtle">
                  {closure ? closure.reason : t('pagination.total', { total: ofDay.length })}
                </span>
              </button>

              <div className="flex flex-col gap-1.5 p-2">
                {ofDay.map((appointment) => {
                  const style = APPOINTMENT_STATUS_STYLES[appointment.status];

                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => onOpen(appointment)}
                      data-appointment={appointment.id}
                      aria-label={`${toTimeLabel(minutesOf(appointment.startsAt))} — ${
                        appointment.patientName
                      } — ${t(`appointments.statuses.${appointment.status}`)}`}
                      className={cn(
                        'cursor-pointer rounded-panel border px-2 py-1.5 text-start',
                        'transition-shadow duration-150 hover:shadow-card',
                        style.block,
                      )}
                    >
                      <Ltr className="text-[11px] font-semibold tabular-nums">
                        {toTimeLabel(minutesOf(appointment.startsAt))}
                      </Ltr>
                      <span className="block truncate text-[11px] leading-snug">
                        {appointment.patientName}
                      </span>
                      <span className="block truncate text-[10px] leading-snug opacity-80">
                        {typeLabel(appointment.type)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
