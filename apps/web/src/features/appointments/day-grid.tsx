import {
  LOOKUP_LIST,
  type CalendarAppointment,
  type ClinicClosure,
  type Doctor,
  type DoctorTimeOff,
} from "@clinic/shared";
import { useMemo, useRef, useState, type CSSProperties, type DragEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";

import { APPOINTMENT_STATUS_STYLES } from "@web/features/appointments/status";
import { useLookupLabels } from "@web/features/lookups/queries";
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
} from "@web/features/appointments/calendar-time";
import { cn } from "@clinic/ui/lib/cn";
import { Icon } from "@clinic/ui/components/icon";
import { Ltr } from "@clinic/ui/components/ltr";
import { PersonName } from "@clinic/ui/components/person-name";

export interface DayGridProps {
  readonly "data-testid"?: string | undefined;
  readonly date: string;
  /** One column each. A doctor sees a single column: their own. */
  readonly doctors: readonly Doctor[];
  readonly appointments: readonly CalendarAppointment[];
  /** Shading the whole grid rather than every column: the clinic is shut, not one doctor. */
  readonly closure?: ClinicClosure | undefined;
  /** Absences touching this day, drawn as hatched blocks in their column. */
  readonly timeOff?: readonly DoctorTimeOff[] | undefined;
  readonly onOpen: (appointment: CalendarAppointment) => void;
  readonly onMove?: ((appointment: CalendarAppointment, minute: number) => void) | undefined;
  /** Clicking empty space books there — the fastest path reception has. */
  readonly onPick?: ((doctorId: string, minute: number) => void) | undefined;
}

// Absolute positioning rather than quarter-hour rows: 20, 45 and 90 minutes all occur. Overlaps
// cannot happen — a column is one doctor — so there is no lane packing.
/** One pass over a list instead of one pass per column. */
function groupBy<TItem>(
  items: readonly TItem[],
  key: (item: TItem) => string,
): Map<string, TItem[]> {
  const groups = new Map<string, TItem[]>();

  for (const item of items) {
    const id = key(item);
    const existing = groups.get(id);

    if (existing) {
      existing.push(item);
    } else {
      groups.set(id, [item]);
    }
  }

  return groups;
}

export function DayGrid({
  date,
  doctors,
  appointments,
  closure,
  timeOff = [],
  onOpen,
  onMove,
  onPick,
  "data-testid": testId = "day-grid",
}: DayGridProps): JSX.Element {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState<string | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement | null>());

  const hours = gridHours();
  const bodyHeight = (hours.length - 1) * HOUR_HEIGHT;

  const byDoctor = useMemo(() => groupBy(appointments, (entry) => entry.doctorId), [appointments]);
  const absencesByDoctor = useMemo(() => groupBy(timeOff, (entry) => entry.doctorId), [timeOff]);

  const handleDrop = (event: DragEvent<HTMLDivElement>, doctorId: string): void => {
    event.preventDefault();
    setDragging(null);

    const id = event.dataTransfer.getData("text/plain");
    const appointment = appointments.find((entry) => entry.id === id);
    const column = columnRefs.current.get(doctorId);

    if (!appointment || !column || !onMove) {
      return;
    }

    const bounds = column.getBoundingClientRect();
    onMove(appointment, minuteFromOffset(event.clientY - bounds.top, bounds.height));
  };

  return (
    <div
      data-testid={testId}
      className="overflow-x-auto border border-line rounded-card bg-surface shadow-card"
    >
      {closure && (
        <p
          data-testid={`${testId}-closure`}
          className="flex items-center gap-2 border-b border-line bg-warning-50 px-4 py-2 text-label text-warning-800"
        >
          <Icon name="alert" />
          {t("appointments.grid.closedOn", { reason: closure.reason })}
        </p>
      )}

      <div className="min-w-max">
        <div
          data-testid={`${testId}-head`}
          className="sticky top-0 z-10 flex border-b border-line bg-surface"
          style={{ paddingInlineStart: 56 }}
        >
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              data-testid={`${testId}-head-${doctor.id}`}
              className="min-w-40 flex-1 truncate px-3 py-2.5 text-center text-label font-medium text-ink"
            >
              <PersonName name={doctor.user.name} />
            </div>
          ))}
        </div>

        <div className={cn("relative flex", closure && "bg-sunken")} style={{ height: bodyHeight }}>
          {/* Hour ruler */}
          <div data-testid={`${testId}-ruler`} className="relative w-14 shrink-0">
            {hours.map((minute) => (
              <span
                key={minute}
                dir="ltr"
                className="absolute -translate-y-1/2 pe-2 text-end text-meta tabular-nums text-ink-subtle"
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
            const column = byDoctor.get(doctor.id) ?? [];

            return (
              <div
                key={doctor.id}
                data-testid={`${testId}-column-${doctor.id}`}
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
                  "hour-rules relative min-w-40 flex-1 border-s border-line",
                  onPick && "cursor-copy",
                )}
                style={{ "--hour-height": `${HOUR_HEIGHT}px` } as CSSProperties}
              >
                {/* An absence overlapping a booking is a real state, and hiding the appointment
                    behind the hatching would be the wrong way round. */}
                {(absencesByDoctor.get(doctor.id) ?? []).map((entry) => {
                  const position = periodPosition(entry.startsAt, entry.endsAt, date);

                  return position === null ? null : (
                    <div
                      key={entry.id}
                      title={entry.reason}
                      aria-label={`${t("schedule.timeOff.title")}: ${entry.reason}`}
                      data-time-off={entry.id}
                      data-testid={`${testId}-time-off-${entry.id}`}
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
                      event.dataTransfer.setData("text/plain", appointment.id);
                      event.dataTransfer.effectAllowed = "move";
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
        <p
          data-testid={`${testId}-drag-hint`}
          className="border-t border-line px-4 py-2 text-label text-ink-subtle"
        >
          {t("appointments.grid.dragHint")}
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

  const compact = blockMinutes(appointment.durationMinutes) < TWO_LINE_MINUTES;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      data-appointment={appointment.id}
      data-testid={`appointment-block-${appointment.id}`}
      title={`${time} · ${appointment.patientName} · ${typeLabel(appointment.type)}`}
      // The block's colour is a status, and a status is never only a colour:
      // the accessible name says it in words.
      aria-label={`${time} — ${appointment.patientName} — ${t(
        `appointments.statuses.${appointment.status}`,
      )}`}
      className={cn(
        "absolute inset-x-1 overflow-hidden rounded-panel border px-2 text-start",
        "cursor-pointer transition-shadow duration-150 hover:shadow-card",
        // A 20px block is the floor a very short appointment is drawn at, and its 1px border spends
        // 2px of that: one 16px line and 2px of padding is all that fits.
        compact ? "py-px" : "py-0.5",
        draggable && "active:cursor-grabbing",
        dragging && "opacity-40",
        style.block,
      )}
      style={position}
    >
      {compact ? (
        <span className="flex items-baseline gap-1.5">
          <Ltr className="shrink-0 text-micro tabular-nums opacity-80">{time}</Ltr>
          <span className="truncate text-meta leading-micro font-medium">
            {appointment.patientName}
          </span>
        </span>
      ) : (
        <>
          <span className="block truncate text-meta leading-micro font-medium">
            {appointment.patientName}
          </span>
          <span className="block truncate text-micro opacity-80">
            <Ltr className="tabular-nums">{time}</Ltr> · {typeLabel(appointment.type)}
          </span>
        </>
      )}
    </button>
  );
}
