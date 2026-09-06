import type { CalendarAppointment } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@web/components/ui';
import { APPOINTMENT_STATUS_STYLES, typeLabelKey } from '@web/features/appointments/status';
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
  readonly onOpen: (appointment: CalendarAppointment) => void;
  /** Clicking a day header jumps the day view there. */
  readonly onPickDay: (date: string) => void;
}

/**
 * Seven days as seven columns of stacked blocks.
 *
 * Deliberately *not* a time grid. A week at the day view's scale is 10,500
 * pixels of mostly-empty column, and the question a week answers is "how full
 * is Thursday?" rather than "what happens at 14:15?" — so each day is a list
 * in time order, and the day view is one click away for the detail.
 *
 * Desktop only. On a phone the same seven columns are 40px wide, which is a
 * week nobody can read; `AppointmentsPage` renders the agenda there instead.
 */
export function WeekView({ date, appointments, onOpen, onPickDay }: WeekViewProps): JSX.Element {
  const { t } = useTranslation();
  const days = weekDates(date);
  const today = toIsoDate(new Date());

  if (appointments.length === 0) {
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

          return (
            <div key={day} className="min-w-40 flex-1">
              <button
                type="button"
                onClick={() => onPickDay(day)}
                className={cn(
                  'block w-full cursor-pointer border-b border-line px-3 py-2.5 text-center',
                  'transition-colors duration-150 hover:bg-row-hover',
                  day === today && 'bg-primary-50',
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
                <span className="block text-[11px] text-ink-subtle">
                  {t('pagination.total', { total: ofDay.length })}
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
                      <span dir="ltr" className="block text-[11px] font-semibold tabular-nums">
                        {toTimeLabel(minutesOf(appointment.startsAt))}
                      </span>
                      <span className="block truncate text-[11px] leading-tight">
                        {appointment.patientName}
                      </span>
                      <span className="block truncate text-[10px] leading-tight opacity-80">
                        {t(typeLabelKey(appointment.type))}
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
