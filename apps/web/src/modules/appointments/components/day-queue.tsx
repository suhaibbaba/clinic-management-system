import {
  APPOINTMENT_STATUS,
  LOOKUP_LIST,
  type Availability,
  type CalendarAppointment,
  type ClinicClosure,
  type Doctor,
  type DoctorTimeOff,
} from "@clinic/shared";
import { formatMinute } from "@web/shared/lib/format";
import { Fragment, useEffect, useMemo, useRef, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Badge, Icon, Ltr, PersonName, usePersonName } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { buildQueue, type QueueRow } from "@web/modules/appointments/lib/calendar-time";
import { AppointmentLine } from "@web/modules/appointments/components/appointment-line";
import { IdleGap } from "@web/modules/appointments/components/idle-gap";
import { formatDuration } from "@web/shared/lib/duration";
import { WEEK_FREE_GAP_MINUTES } from "@web/modules/appointments/constants";
import { useLookupLabels } from "@web/shared/queries/lookups";

export interface DayQueueProps {
  readonly "data-testid"?: string | undefined;
  readonly date: string;
  readonly doctors: readonly Doctor[];
  readonly appointments: readonly CalendarAppointment[];
  readonly availability: ReadonlyMap<string, Availability>;
  readonly closure?: ClinicClosure | undefined;
  readonly timeOff?: readonly DoctorTimeOff[] | undefined;
  readonly nowMinute: number | null;
  readonly onOpen: (appointment: CalendarAppointment) => void;
  readonly onPick?: ((doctorId: string, minute: number) => void) | undefined;
}

const range = (start: number, end: number): string => `${formatMinute(start)}–${formatMinute(end)}`;

const released = (row: QueueRow): boolean =>
  row.kind === "appointment" &&
  (row.appointment.status === APPOINTMENT_STATUS.CANCELLED ||
    row.appointment.status === APPOINTMENT_STATUS.NO_SHOW);

function idleBefore(rows: readonly QueueRow[], index: number): number {
  const row = rows[index];

  if (row?.kind !== "appointment" || released(row)) {
    return 0;
  }

  for (let back = index - 1; back >= 0; back -= 1) {
    const previous = rows[back];

    if (previous === undefined || previous.kind !== "appointment") {
      return 0;
    }

    if (!released(previous)) {
      return Math.max(0, row.start - previous.end);
    }
  }

  return 0;
}

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
                        {idleBefore(rows, index) >= WEEK_FREE_GAP_MINUTES && (
                          <li>
                            <IdleGap minutes={idleBefore(rows, index)} />
                          </li>
                        )}
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
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);

  if (row.kind === "appointment") {
    return (
      <AppointmentLine
        data-testid={`appointment-card-${row.appointment.id}`}
        appointment={row.appointment}
        onOpen={() => onOpen(row.appointment)}
        title={`${range(row.start, row.end)} · ${typeLabel(row.appointment.type)}`}
        trailing={
          <>
            {typeLabel(row.appointment.type)}
            {row.overlaps && <Badge tone="warning">{t("appointments.queue.overlap")}</Badge>}
          </>
        }
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
      <span className="truncate">
        {t("appointments.freeGap", { duration: formatDuration(t, row.end - row.start) })}
      </span>
      <Ltr className="ms-auto shrink-0 tabular-nums">{range(row.start, row.end)}</Ltr>
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

function NowMarker({ minute }: { readonly minute: number }): JSX.Element {
  const { t } = useTranslation();

  return (
    <li data-part="now" role="separator" className="flex items-center gap-2 py-0.5">
      <span className="pill-text inline-flex shrink-0 items-center gap-1 rounded-pill bg-success-600 px-2 py-0.5 text-micro font-medium text-ink-inverse">
        {t("appointments.queue.now")} · <Ltr className="tabular-nums">{formatMinute(minute)}</Ltr>
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-success-500" />
    </li>
  );
}
