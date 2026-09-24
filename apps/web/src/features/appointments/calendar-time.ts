import {
  instantFromLocal,
  localDate,
  minutesFromLocalMidnight,
  occupiesSlot,
  type Availability,
  type CalendarAppointment,
  type DoctorTimeOff,
} from "@clinic/shared";
import i18n from "@web/i18n";
import { clinicTimeZone } from "@web/lib/clinic-zone";

export const minutesOf = (iso: string): number => {
  const at = new Date(iso);

  return minutesFromLocalMidnight(at, toIsoDate(at), clinicTimeZone());
};

export const toIsoDate = (at: Date): string => localDate(at, clinicTimeZone());

export const todayIso = (): string => toIsoDate(new Date());

export function addDays(isoDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Sunday of the week a date falls in — the API snaps weeks the same way. */
export function startOfWeek(isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);

  return addDays(isoDate, -new Date(Date.UTC(year, month - 1, day)).getUTCDay());
}

export const weekDates = (isoDate: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(isoDate), index));

export function toTimeLabel(minute: number): string {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = Math.floor(minute % 60);
  const marker = i18n.t(hours < 12 ? "common.clock.am" : "common.clock.pm");

  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${marker}`;
}

export const instantAt = (isoDate: string, minute: number): string =>
  instantFromLocal(isoDate, minute, clinicTimeZone()).toISOString();

export const QUEUE_STEP_MINUTES = 15;

const MINUTES_PER_DAY = 24 * 60;

export type QueueRow =
  | {
      readonly kind: "appointment";
      readonly start: number;
      readonly end: number;
      readonly appointment: CalendarAppointment;
      readonly overlaps: boolean;
    }
  | { readonly kind: "free"; readonly start: number; readonly end: number }
  | {
      readonly kind: "blocked";
      readonly start: number;
      readonly end: number;
      readonly reason: string;
      readonly allDay: boolean;
    };

export interface DoctorQueue {
  /** No working hours and nothing booked: the column is one "off duty" state. */
  readonly offDuty: boolean;
  readonly rows: readonly QueueRow[];
}

interface Span {
  readonly start: number;
  readonly end: number;
}

const touches = (a: Span, b: Span): boolean => a.start < b.end && b.start < a.end;

const clockMinutes = (time: string): number => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

const KIND_ORDER: Record<QueueRow["kind"], number> = { appointment: 0, blocked: 1, free: 2 };

export function buildQueue({
  date,
  appointments,
  availability,
  timeOff,
}: {
  readonly date: string;
  readonly appointments: readonly CalendarAppointment[];
  readonly availability: Availability | undefined;
  readonly timeOff: readonly DoctorTimeOff[];
}): DoctorQueue {
  const ordered = [...appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const booked: Span[] = [];
  const rows: QueueRow[] = [];
  let latestEnd = Number.NEGATIVE_INFINITY;

  for (const appointment of ordered) {
    const start = minutesOf(appointment.startsAt);
    const end = start + appointment.durationMinutes;
    const occupies = occupiesSlot(appointment.status);

    rows.push({
      kind: "appointment",
      start,
      end,
      appointment,
      overlaps: occupies && start < latestEnd,
    });

    if (occupies) {
      booked.push({ start, end });
      latestEnd = Math.max(latestEnd, end);
    }
  }

  const zone = clinicTimeZone();
  const absences = timeOff.map((entry) => ({
    start: minutesFromLocalMidnight(new Date(entry.startsAt), date, zone),
    end: minutesFromLocalMidnight(new Date(entry.endsAt), date, zone),
    reason: entry.reason,
  }));

  if (availability?.closedReason === "clinic_closure") {
    rows.push({
      kind: "blocked",
      start: 0,
      end: MINUTES_PER_DAY,
      reason: availability.closedNote ?? "",
      allDay: true,
    });
  }

  const offHours =
    availability?.closedReason === "clinic_closed" || availability?.closedReason === "doctor_off";

  // A null ends a run: a booked or past slot between two free ones splits them.
  const runs: (QueueRow | null)[] = [];

  for (const slot of availability?.slots ?? []) {
    const span = { start: clockMinutes(slot.start), end: clockMinutes(slot.end) };
    const absence = absences.find((entry) => touches(span, entry));
    const last = runs.at(-1);

    let next: QueueRow | null = null;

    if (slot.available) {
      next = { kind: "free", ...span };
    } else if (absence && !booked.some((entry) => touches(span, entry))) {
      next = { kind: "blocked", ...span, reason: absence.reason, allDay: false };
    }

    if (
      next &&
      last?.kind === next.kind &&
      last.end >= next.start &&
      (last.kind !== "blocked" || next.kind !== "blocked" || last.reason === next.reason)
    ) {
      runs[runs.length - 1] = { ...last, end: Math.max(last.end, next.end) };
    } else {
      runs.push(next);
    }
  }

  rows.push(
    ...runs.filter(
      (run): run is QueueRow =>
        run !== null && (run.kind !== "free" || run.end - run.start >= QUEUE_STEP_MINUTES),
    ),
  );

  rows.sort((a, b) => a.start - b.start || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

  return { offDuty: offHours && ordered.length === 0, rows };
}
