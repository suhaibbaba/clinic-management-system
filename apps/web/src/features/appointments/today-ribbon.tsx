import { APPOINTMENT_STATUS, type CalendarAppointment } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Icon, useToast } from '@web/components/ui';
import { useAppointmentStep } from '@web/features/appointments/queries';
import { APPOINTMENT_STATUS_STYLES } from '@web/features/appointments/status';
import { minutesOf, toTimeLabel } from '@web/features/appointments/calendar-time';
import { errorMessageKey } from '@web/lib/api-error';
import { cn } from '@web/lib/cn';

export interface TodayRibbonProps {
  readonly appointments: readonly CalendarAppointment[];
  readonly onOpen: (appointment: CalendarAppointment) => void;
  /** Reception marks arrivals; a technician sees the ribbon but no button. */
  readonly canMark: boolean;
}

/**
 * The next few people through the door, with the one button reception presses
 * most.
 *
 * A calendar answers "what does the day look like"; this answers "who is next"
 * — a different question, asked far more often, and the reason the front desk
 * would otherwise scan a grid for the current time. Marking someone arrived is
 * one tap from here rather than a click into a drawer.
 *
 * Only what is still ahead: an appointment already completed or missed is
 * history, and a ribbon of history is a ribbon nobody reads.
 */
export function TodayRibbon({ appointments, onOpen, canMark }: TodayRibbonProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const step = useAppointmentStep();

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const upcoming = appointments
    .filter(
      (entry) =>
        entry.status === APPOINTMENT_STATUS.CONFIRMED ||
        entry.status === APPOINTMENT_STATUS.REQUESTED ||
        entry.status === APPOINTMENT_STATUS.ARRIVED,
    )
    // Everything from an hour ago onwards: someone fifteen minutes late is
    // exactly who reception is looking for.
    .filter((entry) => minutesOf(entry.startsAt) >= nowMinutes - 60)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);

  const markArrived = async (id: string): Promise<void> => {
    try {
      await step.mutateAsync({ id, step: 'arrived' });
      toast.success('appointments.updated');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <section
      aria-label={t('appointments.ribbon.title')}
      className="rounded-card bg-surface p-4 shadow-card"
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon name="clock" className="size-4 text-primary-600" />
        <h2 className="text-value font-semibold text-ink">{t('appointments.ribbon.title')}</h2>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-label text-ink-muted">{t('appointments.ribbon.none')}</p>
      ) : (
        // Scrolls sideways rather than wrapping: a ribbon that grows to three
        // rows on a busy morning stops being a ribbon.
        <ul className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {upcoming.map((appointment) => {
            const style = APPOINTMENT_STATUS_STYLES[appointment.status];
            const arrived = appointment.status === APPOINTMENT_STATUS.ARRIVED;

            return (
              <li key={appointment.id} className="shrink-0">
                <div
                  className={cn('flex w-52 flex-col gap-1.5 rounded-panel border p-3', style.block)}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(appointment)}
                    className="cursor-pointer text-start"
                  >
                    <span dir="ltr" className="block text-value font-semibold tabular-nums">
                      {toTimeLabel(minutesOf(appointment.startsAt))}
                    </span>
                    <span className="block truncate text-label font-medium">
                      {appointment.patientName}
                    </span>
                    <span className="block truncate text-[11px] opacity-80">
                      {appointment.doctorName}
                    </span>
                  </button>

                  {canMark && !arrived && (
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={step.isPending}
                      onClick={() => void markArrived(appointment.id)}
                    >
                      {t('appointments.actions.arrived')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
