import type { CalendarAppointment } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, EmptyState, Icon } from '@web/components/ui';
import {
  APPOINTMENT_STATUS_STYLES,
  statusLabelKey,
  typeLabelKey,
} from '@web/features/appointments/status';
import { minutesOf, toTimeLabel } from '@web/features/appointments/calendar-time';
import { cn } from '@web/lib/cn';

export interface AgendaListProps {
  readonly appointments: readonly CalendarAppointment[];
  readonly onOpen: (appointment: CalendarAppointment) => void;
  /** Shown when the caller can see more than one doctor's day. */
  readonly showDoctor: boolean;
}

/**
 * The day as a vertical list of cards — what the day grid becomes on a phone.
 *
 * A time grid at 390px is a 40px column: a fifteen-minute appointment is ten
 * pixels tall and nothing is legible or tappable. An agenda drops the spatial
 * metaphor and keeps the thing it was carrying, which is the order.
 */
export function AgendaList({ appointments, onOpen, showDoctor }: AgendaListProps): JSX.Element {
  const { t } = useTranslation();

  if (appointments.length === 0) {
    return <EmptyState icon="calendar" title="appointments.empty" hint="appointments.emptyHint" />;
  }

  const ordered = [...appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <ul className="flex flex-col gap-3">
      {ordered.map((appointment) => {
        const style = APPOINTMENT_STATUS_STYLES[appointment.status];

        return (
          <li key={appointment.id}>
            <button
              type="button"
              onClick={() => onOpen(appointment)}
              data-appointment={appointment.id}
              className={cn(
                'flex w-full cursor-pointer items-stretch gap-3 rounded-card bg-surface p-3',
                'text-start shadow-card transition-shadow duration-150 hover:shadow-float',
              )}
            >
              {/* The status stripe: the colour the grid uses, in the shape a
                  card can carry it. */}
              <span
                aria-hidden="true"
                className={cn('w-1 shrink-0 rounded-pill border-4', style.block)}
              />

              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span dir="ltr" className="text-value font-semibold tabular-nums text-ink">
                    {toTimeLabel(minutesOf(appointment.startsAt))}
                  </span>
                  <Badge tone={style.tone}>{t(statusLabelKey(appointment.status))}</Badge>
                </span>

                <span className="truncate text-value font-medium text-ink">
                  {appointment.patientName}
                </span>

                <span className="flex flex-wrap items-center gap-x-2 text-label text-ink-muted">
                  <span>{t(typeLabelKey(appointment.type))}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t('appointments.durationMinutes', { count: appointment.durationMinutes })}
                  </span>
                  {showDoctor && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{appointment.doctorName}</span>
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
