import { APPOINTMENT_STATUS, LOOKUP_LIST, type CalendarAppointment } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Avatar, Badge, Icon, Ltr, PersonName } from '@web/components/ui';
import { minutesOf, toTimeLabel } from '@web/features/appointments/calendar-time';
import { APPOINTMENT_STATUS_STYLES, statusLabelKey } from '@web/features/appointments/status';
import { useLookupLabels } from '@web/features/lookups/queries';
import { cn } from '@web/lib/cn';

export interface ScheduleTimelineProps {
  readonly rows: readonly CalendarAppointment[];
  /** A technician reads the day, but the file behind the name is not theirs. */
  readonly linkPatients: boolean;
  readonly onConfirm: ((appointment: CalendarAppointment) => void) | undefined;
  readonly nowMinute: number | null;
}

const SPENT_STATUSES: readonly string[] = [
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.CANCELLED,
];

// The day as a rail rather than a table: a row of times down one edge says what is behind, what is
// next and where "now" falls, which four sortable columns never do.
export function ScheduleTimeline({
  rows,
  linkPatients,
  onConfirm,
  nowMinute,
}: ScheduleTimelineProps): JSX.Element {
  const { t } = useTranslation();
  // The clinic's own list, never a constant: a clinic that added "تبييض" sees it here too.
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);
  const slots = groupByTime(rows);

  return (
    <ol className="relative px-[22px] pt-2 pb-[22px]">
      {slots.map((slot, index) => {
        const spent = slot.appointments.every((row) => SPENT_STATUSES.includes(row.status));
        const isNow = nowMinute !== null && isCurrentSlot(slots, index, nowMinute);

        return (
          <li
            key={slot.minute}
            className="relative grid grid-cols-[52px_14px_1fr] gap-x-3.5 sm:grid-cols-[64px_14px_1fr]"
          >
            <Ltr className="pt-5 text-start text-label font-medium text-ink-muted">
              {toTimeLabel(slot.minute)}
            </Ltr>

            {/* The rail: a hairline down the column with one node at the slot's time. The first and
                last slots start and stop it short so it does not run off the panel. */}
            <span
              aria-hidden="true"
              className={cn(
                'relative',
                "before:absolute before:end-[6px] before:w-0.5 before:bg-line before:content-['']",
                index === 0 ? 'before:top-[26px]' : 'before:top-0',
                index === slots.length - 1 ? 'before:h-[26px]' : 'before:bottom-0',
              )}
            >
              <span
                className={cn(
                  'absolute top-6 end-[1.5px] size-[11px] rounded-pill border-[3px]',
                  spent
                    ? 'border-neutral-400 bg-neutral-400'
                    : isNow
                      ? 'border-success-500 bg-surface shadow-[0_0_0_4px_rgb(57_186_151_/_0.22)]'
                      : 'border-primary-600 bg-surface',
                )}
              />
            </span>

            {/* Two patients at 09:30 stack under one time and one node, as the reference draws
                them. */}
            <div className="relative min-w-0">
              {isNow && <NowLine label={t('dashboard.now')} minute={nowMinute} />}

              {slot.appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className={cn(
                    'my-2 flex items-center gap-3 rounded-panel border bg-surface px-4 py-3',
                    SPENT_STATUSES.includes(appointment.status) && 'opacity-55',
                    isNow ? 'border-success-500 shadow-now' : 'border-line',
                  )}
                >
                  <Avatar
                    name={appointment.patientName}
                    tintKey={appointment.patientId}
                    size={34}
                    className="text-meta"
                  />

                  <div className="min-w-0 flex-1">
                    {linkPatients ? (
                      <Link
                        to={`/patients/${appointment.patientId}`}
                        className="block truncate text-section font-medium text-ink transition-colors duration-150 hover:text-primary-700"
                      >
                        {appointment.patientName}
                      </Link>
                    ) : (
                      <b className="block truncate text-section font-medium text-ink">
                        {appointment.patientName}
                      </b>
                    )}

                    <span className="flex flex-wrap items-center gap-1 text-meta text-ink-muted">
                      <PersonName name={appointment.doctorName} />
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{typeLabel(appointment.type)}</span>
                    </span>
                  </div>

                  <Badge tone={APPOINTMENT_STATUS_STYLES[appointment.status].tone}>
                    {t(statusLabelKey(appointment.status))}
                  </Badge>

                  {/* Only where there is something to do: a confirm button beside a completed
                      appointment is a button that does nothing. */}
                  {appointment.status === APPOINTMENT_STATUS.REQUESTED && (
                    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      {onConfirm && (
                        <QuickAction
                          label={t('appointments.actions.confirm')}
                          icon="check"
                          onClick={() => onConfirm(appointment)}
                        />
                      )}
                      <QuickAction
                        label={t('dashboard.call')}
                        icon="phone"
                        href={`tel:${appointment.patientPhone.replace(/[\s-]/g, '')}`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function QuickAction({
  label,
  icon,
  onClick,
  href,
}: {
  readonly label: string;
  readonly icon: 'check' | 'phone';
  readonly onClick?: (() => void) | undefined;
  readonly href?: string | undefined;
}): JSX.Element {
  const className = cn(
    'inline-flex size-11 cursor-pointer items-center justify-center lg:size-[34px]',
    'rounded-chip border border-line bg-canvas text-ink-muted',
    'transition-colors duration-150 hover:border-success-700 hover:text-success-700',
  );

  return href === undefined ? (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={className}>
      <Icon name={icon} className="size-3.5" />
    </button>
  ) : (
    <a href={href} aria-label={label} title={label} className={className}>
      <Icon name={icon} className="size-3.5" />
    </a>
  );
}

// Dashed and green, across the appointment column with its label over the rail. The label is not
// itself the `<Ltr>` island: `start-*` resolves against the element's own direction, so an island
// carrying the offset would place it at the wrong edge of an Arabic page.
function NowLine({
  label,
  minute,
}: {
  readonly label: string;
  readonly minute: number;
}): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-1 z-[2] border-t-2 border-dashed border-success-500"
    >
      {/* Over the rail rather than the card, which is the gap the reference leaves for it. */}
      <span className="absolute -top-[11px] start-[-54px] rounded-md bg-success-500 px-2 py-[3px] text-micro font-medium text-ink-inverse">
        <Ltr>
          {label} {toTimeLabel(minute)}
        </Ltr>
      </span>
    </span>
  );
}

interface Slot {
  readonly minute: number;
  readonly appointments: readonly CalendarAppointment[];
}

/** Two patients at 09:30 share one time label and one node column, as the reference draws them. */
function groupByTime(rows: readonly CalendarAppointment[]): readonly Slot[] {
  const byMinute = new Map<number, CalendarAppointment[]>();

  for (const row of rows) {
    const minute = minutesOf(row.startsAt);
    const existing = byMinute.get(minute);

    if (existing) {
      existing.push(row);
    } else {
      byMinute.set(minute, [row]);
    }
  }

  return [...byMinute.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minute, appointments]) => ({ minute, appointments }));
}

/** The slot "now" sits in: the last one already started, or the first if the day has not begun. */
function isCurrentSlot(slots: readonly Slot[], index: number, nowMinute: number): boolean {
  const started = slots.filter((slot) => slot.minute <= nowMinute);

  if (started.length === 0) {
    return index === 0 && slots[0] !== undefined && nowMinute < slots[0].minute;
  }

  return slots[started.length - 1]?.minute === slots[index]?.minute;
}
