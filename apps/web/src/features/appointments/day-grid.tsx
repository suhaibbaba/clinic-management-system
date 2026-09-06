import type { CalendarAppointment, Doctor } from '@clinic/shared';
import { useRef, useState, type DragEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { APPOINTMENT_STATUS_STYLES, typeLabelKey } from '@web/features/appointments/status';
import {
  blockPosition,
  GRID_START_MINUTE,
  gridHours,
  HOUR_HEIGHT,
  minuteFromOffset,
  minutesOf,
  toTimeLabel,
} from '@web/features/appointments/calendar-time';
import { cn } from '@web/lib/cn';

export interface DayGridProps {
  /** One column each. A doctor sees a single column: their own. */
  readonly doctors: readonly Doctor[];
  readonly appointments: readonly CalendarAppointment[];
  readonly onOpen: (appointment: CalendarAppointment) => void;
  /**
   * A block was dropped on a new time. Absent when the caller may not
   * reschedule, which also removes the drag affordance entirely.
   */
  readonly onMove?: ((appointment: CalendarAppointment, minute: number) => void) | undefined;
  /** Clicking empty space books there — the fastest path reception has. */
  readonly onPick?: ((doctorId: string, minute: number) => void) | undefined;
}

/**
 * The day, as a time grid with one column per doctor.
 *
 * Absolute positioning inside a percentage-height column rather than a CSS
 * grid of quarter-hour rows: appointments are not aligned to any single
 * granularity — 20, 45 and 90 minutes all occur — and a row grid would either
 * lie about their length or need 60 rows an hour.
 *
 * Overlaps cannot happen: the database refuses them for one doctor, and each
 * column *is* one doctor. That is why a block can take the full column width
 * without a lane-packing algorithm, and it is worth knowing before adding one.
 */
export function DayGrid({
  doctors,
  appointments,
  onOpen,
  onMove,
  onPick,
}: DayGridProps): JSX.Element {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState<string | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement | null>());

  const hours = gridHours();
  const bodyHeight = (hours.length - 1) * HOUR_HEIGHT;

  const handleDrop = (event: DragEvent<HTMLDivElement>, doctorId: string): void => {
    event.preventDefault();
    setDragging(null);

    const id = event.dataTransfer.getData('text/plain');
    const appointment = appointments.find((entry) => entry.id === id);
    const column = columnRefs.current.get(doctorId);

    if (!appointment || !column || !onMove) {
      return;
    }

    const bounds = column.getBoundingClientRect();
    onMove(appointment, minuteFromOffset(event.clientY - bounds.top, bounds.height));
  };

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card">
      <div className="min-w-max">
        {/* ── Column headers ────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-10 flex border-b border-line bg-surface"
          style={{ paddingInlineStart: 56 }}
        >
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="min-w-40 flex-1 truncate px-3 py-2.5 text-center text-label font-semibold text-ink"
            >
              {doctor.user.name}
            </div>
          ))}
        </div>

        <div className="relative flex" style={{ height: bodyHeight }}>
          {/* ── Hour ruler ──────────────────────────────────────────── */}
          <div className="relative w-14 shrink-0">
            {hours.map((minute) => (
              <span
                key={minute}
                dir="ltr"
                className="absolute -translate-y-1/2 pe-2 text-end text-[11px] tabular-nums text-ink-subtle"
                style={{
                  top: `${((minute - GRID_START_MINUTE) / 60) * HOUR_HEIGHT}px`,
                  insetInlineEnd: 0,
                }}
              >
                {toTimeLabel(minute)}
              </span>
            ))}
          </div>

          {doctors.map((doctor) => {
            const column = appointments.filter((entry) => entry.doctorId === doctor.id);

            return (
              <div
                key={doctor.id}
                ref={(element) => {
                  columnRefs.current.set(doctor.id, element);
                }}
                onDragOver={(event) => {
                  if (onMove) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => handleDrop(event, doctor.id)}
                onClick={(event) => {
                  if (!onPick || event.target !== event.currentTarget) {
                    return;
                  }

                  const bounds = event.currentTarget.getBoundingClientRect();
                  onPick(doctor.id, minuteFromOffset(event.clientY - bounds.top, bounds.height));
                }}
                className={cn(
                  'relative min-w-40 flex-1 border-s border-line',
                  onPick && 'cursor-copy',
                )}
              >
                {/* Hour lines, drawn on the column so they scroll with it. */}
                {hours.slice(0, -1).map((minute) => (
                  <div
                    key={minute}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 border-t border-line/70"
                    style={{ top: `${((minute - GRID_START_MINUTE) / 60) * HOUR_HEIGHT}px` }}
                  />
                ))}

                {column.map((appointment) => (
                  <AppointmentBlock
                    key={appointment.id}
                    appointment={appointment}
                    draggable={Boolean(onMove)}
                    dragging={dragging === appointment.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', appointment.id);
                      event.dataTransfer.effectAllowed = 'move';
                      setDragging(appointment.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onOpen={() => onOpen(appointment)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {onMove && (
        <p className="border-t border-line px-4 py-2 text-label text-ink-subtle">
          {t('appointments.grid.dragHint')}
        </p>
      )}
    </div>
  );
}

interface BlockProps {
  readonly appointment: CalendarAppointment;
  readonly draggable: boolean;
  readonly dragging: boolean;
  readonly onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  readonly onDragEnd: () => void;
  readonly onOpen: () => void;
}

function AppointmentBlock({
  appointment,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: BlockProps): JSX.Element {
  const { t } = useTranslation();
  const style = APPOINTMENT_STATUS_STYLES[appointment.status];
  const position = blockPosition(appointment);

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      data-appointment={appointment.id}
      // The block's colour is a status, and a status is never only a colour:
      // the accessible name says it in words.
      aria-label={`${toTimeLabel(minutesOf(appointment.startsAt))} — ${appointment.patientName} — ${t(
        `appointments.statuses.${appointment.status}`,
      )}`}
      className={cn(
        'absolute inset-x-1 overflow-hidden rounded-panel border px-2 py-1 text-start',
        'cursor-pointer transition-shadow duration-150 hover:shadow-card',
        draggable && 'active:cursor-grabbing',
        dragging && 'opacity-40',
        style.block,
      )}
      style={position}
    >
      <span className="block truncate text-[11px] font-semibold leading-tight">
        {appointment.patientName}
      </span>
      <span className="block truncate text-[10px] leading-tight opacity-80">
        <span dir="ltr" className="tabular-nums">
          {toTimeLabel(minutesOf(appointment.startsAt))}
        </span>{' '}
        · {t(typeLabelKey(appointment.type))}
      </span>
    </button>
  );
}
