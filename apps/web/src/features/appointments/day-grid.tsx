import {
  LOOKUP_LIST,
  type CalendarAppointment,
  type ClinicClosure,
  type Doctor,
  type DoctorTimeOff,
} from '@clinic/shared';
import { useRef, useState, type DragEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { APPOINTMENT_STATUS_STYLES } from '@web/features/appointments/status';
import { useLookupLabels } from '@web/features/lookups/queries';
import {
  blockMinutes,
  blockPosition,
  GRID_START_MINUTE,
  gridHours,
  HOUR_HEIGHT,
  minuteFromOffset,
  minutesOf,
  periodPosition,
  toTimeLabel,
  TWO_LINE_MINUTES,
} from '@web/features/appointments/calendar-time';
import { cn } from '@web/lib/cn';
import { Icon } from '@web/components/ui/icon';
import { Ltr } from '@web/components/ui/ltr';
import { PersonName } from '@web/components/ui/person-name';

export interface DayGridProps {
  /** The day being drawn, as a local `YYYY-MM-DD`. */
  readonly date: string;
  /** One column each. A doctor sees a single column: their own. */
  readonly doctors: readonly Doctor[];
  readonly appointments: readonly CalendarAppointment[];
  /**
   * The closure covering this day, if one does. Shading the whole grid rather
   * than every column: the clinic is shut, not one doctor.
   */
  readonly closure?: ClinicClosure | undefined;
  /** Absences touching this day, drawn as hatched blocks in their column. */
  readonly timeOff?: readonly DoctorTimeOff[] | undefined;
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
  date,
  doctors,
  appointments,
  closure,
  timeOff = [],
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
      {closure && (
        // The reason, in the clinic's own words. "The clinic is closed" is not
        // something reception can repeat down the phone; "عيد الفطر" is.
        <p className="flex items-center gap-2 border-b border-line bg-warning-50 px-4 py-2 text-label text-warning-800">
          <Icon name="alert" />
          {t('appointments.grid.closedOn', { reason: closure.reason })}
        </p>
      )}

      <div className="min-w-max">
        {/* Column headers */}
        <div
          className="sticky top-0 z-10 flex border-b border-line bg-surface"
          style={{ paddingInlineStart: 56 }}
        >
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="min-w-40 flex-1 truncate px-3 py-2.5 text-center text-label font-semibold text-ink"
            >
              <PersonName name={doctor.user.name} />
            </div>
          ))}
        </div>

        <div className={cn('relative flex', closure && 'bg-sunken')} style={{ height: bodyHeight }}>
          {/* Hour ruler */}
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

                {/*
                  Time off, under the appointments: an absence that overlaps a
                  booking is a real state — the seed ships one — and hiding the
                  appointment behind the hatching would be the wrong way round.
                */}
                {timeOff
                  .filter((entry) => entry.doctorId === doctor.id)
                  .map((entry) => {
                    const position = periodPosition(entry.startsAt, entry.endsAt, date);

                    return position === null ? null : (
                      <div
                        key={entry.id}
                        title={entry.reason}
                        aria-label={`${t('schedule.timeOff.title')}: ${entry.reason}`}
                        data-time-off={entry.id}
                        className="absolute inset-x-0 hatched border-y border-line-strong/60"
                        style={position}
                      />
                    );
                  })}

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
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);
  const style = APPOINTMENT_STATUS_STYLES[appointment.status];
  const position = blockPosition(appointment);
  const time = toTimeLabel(minutesOf(appointment.startsAt));

  /*
   * A short appointment says the same thing on one line.
   *
   * The block is as many pixels tall as the appointment is minutes long, and
   * two lines of this type need 39 of them — so at the clinic's default of 30
   * minutes the block clipped its own second line horizontally through the
   * middle of the glyphs, on nearly every appointment in the calendar. One
   * line fits, in the order a calendar is scanned: the time, then who.
   *
   * The type is what goes, because it is the least of the three and the only
   * one the drawer behind the block does not make people hunt for. It stays in
   * the tooltip, and the accessible name is unchanged either way.
   */
  const compact = blockMinutes(appointment.durationMinutes) < TWO_LINE_MINUTES;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      data-appointment={appointment.id}
      title={`${time} · ${appointment.patientName} · ${typeLabel(appointment.type)}`}
      // The block's colour is a status, and a status is never only a colour:
      // the accessible name says it in words.
      aria-label={`${time} — ${appointment.patientName} — ${t(
        `appointments.statuses.${appointment.status}`,
      )}`}
      className={cn(
        'absolute inset-x-1 overflow-hidden rounded-panel border px-2 text-start',
        'cursor-pointer transition-shadow duration-150 hover:shadow-card',
        // A 20px block — the floor a very short appointment is drawn at — has
        // room for one 11px line and 4px of padding, and nothing else.
        compact ? 'py-0.5' : 'py-1',
        draggable && 'active:cursor-grabbing',
        dragging && 'opacity-40',
        style.block,
      )}
      style={position}
    >
      {compact ? (
        <span className="flex items-baseline gap-1.5 leading-tight">
          <Ltr className="shrink-0 text-[10px] tabular-nums opacity-80">{time}</Ltr>
          <span className="truncate text-[11px] font-semibold">{appointment.patientName}</span>
        </span>
      ) : (
        <>
          <span className="block truncate text-[11px] font-semibold leading-snug">
            {appointment.patientName}
          </span>
          <span className="block truncate text-[10px] leading-snug opacity-80">
            <Ltr className="tabular-nums">{time}</Ltr> · {typeLabel(appointment.type)}
          </span>
        </>
      )}
    </button>
  );
}
