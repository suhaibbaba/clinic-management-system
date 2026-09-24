import {
  APPOINTMENT_STATUS,
  LOOKUP_LIST,
  type Availability,
  type CalendarAppointment,
  type ClinicClosure,
  type Doctor,
  type DoctorTimeOff,
} from "@clinic/shared";
import { Fragment, useEffect, useMemo, useRef, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Badge, Icon, Ltr, PersonName, usePersonName } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { buildQueue, toTimeLabel, type QueueRow } from "@web/features/appointments/calendar-time";
import { APPOINTMENT_STATUS_STYLES, statusAccent } from "@web/features/appointments/status";
import { useLookupLabels } from "@web/features/lookups/queries";
import { TONE_SURFACE } from "@clinic/ui/components/tone";

export interface DayQueueProps {
  readonly "data-testid"?: string | undefined;
  readonly date: string;
  /** One column each. A doctor sees a single column: their own. */
  readonly doctors: readonly Doctor[];
  readonly appointments: readonly CalendarAppointment[];
  /** Keyed by doctor id; a doctor without an answer yet shows their cards alone. */
  readonly availability: ReadonlyMap<string, Availability>;
  readonly closure?: ClinicClosure | undefined;
  readonly timeOff?: readonly DoctorTimeOff[] | undefined;
  /** The clinic's current minute when the date is today, otherwise null. */
  readonly nowMinute: number | null;
  readonly onOpen: (appointment: CalendarAppointment) => void;
  /** Clicking a free gap books there. Absent for a reader who cannot book. */
  readonly onPick?: ((doctorId: string, minute: number) => void) | undefined;
}

const range = (start: number, end: number): string => `${toTimeLabel(start)}–${toTimeLabel(end)}`;

export function DayQueue({
  date,
  doctors,
  appointments,
  availability,
  closure,
  timeOff = [],
  nowMinute,
  onOpen,
  onPick,
  "data-testid": testId = "day-queue",
}: DayQueueProps): JSX.Element {
  const { t } = useTranslation();
  const doctorName = usePersonName();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledTo = useRef<string | null>(null);

  const queues = useMemo(
    () =>
      new Map(
        doctors.map((doctor) => [
          doctor.id,
          buildQueue({
            date,
            appointments: appointments.filter((entry) => entry.doctorId === doctor.id),
            availability: availability.get(doctor.id),
            timeOff: timeOff.filter((entry) => entry.doctorId === doctor.id),
          }),
        ]),
      ),
    [date, doctors, appointments, availability, timeOff],
  );

  const hasRows = [...queues.values()].some((queue) => queue.rows.length > 0);

  useEffect(() => {
    const container = scroller.current;
    const marker = container?.querySelector<HTMLElement>('[data-part="now"]');

    if (!container || !marker || scrolledTo.current === date) {
      return;
    }

    scrolledTo.current = date;
    container.scrollTop = Math.max(0, marker.offsetTop - container.clientHeight / 3);
  }, [date, hasRows]);

  return (
    <div
      data-testid={testId}
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
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

      <div ref={scroller} className="relative max-h-[min(760px,75dvh)] overflow-auto">
        <div className="flex min-w-max">
          {doctors.map((doctor) => {
            const queue = queues.get(doctor.id);
            const rows = queue?.rows ?? [];
            const firstLater =
              nowMinute === null ? -1 : rows.findIndex((row) => row.start > nowMinute);
            const nowIndex =
              nowMinute === null ? null : firstLater === -1 ? rows.length : firstLater;

            return (
              <section
                key={doctor.id}
                data-testid={`${testId}-column-${doctor.id}`}
                aria-label={doctorName(doctor.user.name)}
                className="flex min-w-60 flex-1 flex-col border-s border-line first:border-s-0"
              >
                <header
                  data-testid={`${testId}-head-${doctor.id}`}
                  className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5"
                >
                  <Avatar name={doctorName(doctor.user.name)} tintKey={doctor.id} size={26} />
                  <PersonName
                    name={doctor.user.name}
                    className="truncate text-label font-medium text-ink"
                  />
                </header>

                <ol className="flex flex-1 flex-col gap-1.5 p-2">
                  {queue?.offDuty ? (
                    <li
                      data-testid={`${testId}-off-${doctor.id}`}
                      className="hatched flex flex-1 items-center justify-center rounded-panel border border-line px-3 py-6 text-meta text-ink-muted"
                    >
                      {t("appointments.queue.offDuty")}
                    </li>
                  ) : (
                    rows.map((row, index) => (
                      <Fragment key={`${row.kind}-${row.start}-${index}`}>
                        {index === nowIndex && <NowMarker minute={nowMinute ?? 0} />}
                        <li>
                          <QueueEntry
                            row={row}
                            testId={testId}
                            onOpen={onOpen}
                            {...(onPick && { onPick: (minute) => onPick(doctor.id, minute) })}
                          />
                        </li>
                      </Fragment>
                    ))
                  )}
                  {!queue?.offDuty && nowIndex === rows.length && (
                    <NowMarker minute={nowMinute ?? 0} />
                  )}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QueueEntry({
  row,
  testId,
  onOpen,
  onPick,
}: {
  readonly row: QueueRow;
  readonly testId: string;
  readonly onOpen: (appointment: CalendarAppointment) => void;
  readonly onPick?: ((minute: number) => void) | undefined;
}): JSX.Element {
  const { t } = useTranslation();

  if (row.kind === "appointment") {
    return (
      <AppointmentCard
        appointment={row.appointment}
        start={row.start}
        end={row.end}
        overlaps={row.overlaps}
        onOpen={() => onOpen(row.appointment)}
      />
    );
  }

  if (row.kind === "blocked") {
    return (
      <div
        data-testid={`${testId}-blocked-${row.start}`}
        className="hatched flex min-h-(--control-h-sm) items-center gap-2 rounded-panel border border-line px-3 py-1.5 text-meta text-ink-muted"
      >
        <span className="truncate">
          {row.reason || t(row.allDay ? "appointments.queue.closed" : "appointments.queue.timeOff")}
        </span>
        {!row.allDay && (
          <Ltr className="ms-auto shrink-0 tabular-nums">{range(row.start, row.end)}</Ltr>
        )}
      </div>
    );
  }

  const content = (
    <>
      <Icon name="plus" className="size-4 shrink-0" />
      <span>{t("appointments.queue.free")}</span>
      <Ltr className="tabular-nums">{range(row.start, row.end)}</Ltr>
    </>
  );
  const shape =
    "flex min-h-(--control-h-sm) w-full items-center gap-1.5 rounded-panel border border-dashed border-line-strong px-3 text-meta text-ink-subtle";

  return onPick ? (
    <button
      type="button"
      data-testid={`${testId}-free-${row.start}`}
      onClick={() => onPick(row.start)}
      className={cn(
        shape,
        "cursor-pointer transition-colors duration-150 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700",
      )}
    >
      {content}
    </button>
  ) : (
    <div data-testid={`${testId}-free-${row.start}`} className={shape}>
      {content}
    </div>
  );
}

function AppointmentCard({
  appointment,
  start,
  end,
  overlaps,
  onOpen,
}: {
  readonly appointment: CalendarAppointment;
  readonly start: number;
  readonly end: number;
  readonly overlaps: boolean;
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);
  const cancelled = appointment.status === APPOINTMENT_STATUS.CANCELLED;
  const status = t(`appointments.statuses.${appointment.status}`);

  return (
    <button
      type="button"
      onClick={onOpen}
      data-appointment={appointment.id}
      data-testid={`appointment-card-${appointment.id}`}
      // The tint is a status, and a status is never only a colour: the accessible name says it.
      aria-label={`${toTimeLabel(start)} — ${appointment.patientName} — ${status}`}
      className={cn(
        "flex min-h-15 w-full cursor-pointer flex-col justify-center gap-0.5 rounded-panel border border-s-[3px] px-3 py-2 text-start",
        "transition-[box-shadow,translate] duration-150 hover:-translate-y-px hover:shadow-card",
        TONE_SURFACE[APPOINTMENT_STATUS_STYLES[appointment.status].tone],
        statusAccent(appointment.status),
        cancelled && "bg-surface",
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className={cn("truncate text-meta font-medium", cancelled && "line-through")}>
          {appointment.patientName}
        </span>
        {overlaps && (
          <Badge tone="warning" className="ms-auto shrink-0">
            {t("appointments.queue.overlap")}
          </Badge>
        )}
      </span>
      <span className="truncate text-micro opacity-80">
        <Ltr className="tabular-nums">{range(start, end)}</Ltr> · {typeLabel(appointment.type)}
      </span>
    </button>
  );
}

function NowMarker({ minute }: { readonly minute: number }): JSX.Element {
  const { t } = useTranslation();

  return (
    <li data-part="now" role="separator" className="flex items-center gap-2 py-0.5">
      <span className="pill-text inline-flex shrink-0 items-center gap-1 rounded-pill bg-success-600 px-2 py-0.5 text-micro font-medium text-ink-inverse">
        {t("appointments.queue.now")} · <Ltr className="tabular-nums">{toTimeLabel(minute)}</Ltr>
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-success-500" />
    </li>
  );
}
