import {
  instantFromLocal,
  localDate,
  minutesFromLocalMidnight,
  type CalendarAppointment,
} from "@clinic/shared";
import i18n from "@web/i18n";
import { clinicTimeZone } from "@web/lib/clinic-zone";

// Minutes from midnight in the clinic's timezone, not the browser's: a laptop set elsewhere would
// draw 09:00 and book it as 06:00.

/** The grid runs 07:00–22:00: earlier than any clinic opens, later than it shuts. */
export const GRID_START_MINUTE = 7 * 60;
export const GRID_END_MINUTE = 22 * 60;
export const GRID_MINUTES = GRID_END_MINUTE - GRID_START_MINUTE;

export const HOUR_HEIGHT = 60;

// A block is as many pixels tall as it is minutes long, and two lines of this type need 39 — so the
// clinic's default 30-minute appointment states its facts on one line.
export const TWO_LINE_MINUTES = 40;

/** A floor, so a 5-minute appointment is still readable and clickable rather than a hairline. */
export const MIN_BLOCK_MINUTES = 20;

export const blockMinutes = (durationMinutes: number): number =>
  Math.max(durationMinutes, MIN_BLOCK_MINUTES);

/** Slot granularity when dragging: a clinic books on the quarter hour. */
export const DRAG_STEP_MINUTES = 15;

export const minutesOf = (iso: string): number => {
  const at = new Date(iso);

  return minutesFromLocalMidnight(at, toIsoDate(at), clinicTimeZone());
};

export const toIsoDate = (at: Date): string => localDate(at, clinicTimeZone());

export const todayIso = (): string => toIsoDate(new Date());

export function addDays(isoDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);

  // Plain calendar arithmetic on the date parts, in UTC so no zone can shift
  // the answer by a day.
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Sunday of the week a date falls in — the API snaps weeks the same way. */
export function startOfWeek(isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);

  return addDays(isoDate, -new Date(Date.UTC(year, month - 1, day)).getUTCDay());
}

export const weekDates = (isoDate: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(isoDate), index));

// The marker is the same in both languages and comes from the locale files rather than `Intl`,
// which writes `ص`/`م` in Arabic. Latin digits throughout: this renders inside an `<Ltr>` island.
export function toTimeLabel(minute: number): string {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = Math.floor(minute % 60);
  const marker = i18n.t(hours < 12 ? "common.clock.am" : "common.clock.pm");

  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${marker}`;
}

/** A clock face with its period apart, for a label that sets the period on a line of its own. */
export function toClockParts(minute: number): {
  readonly time: string;
  readonly periodKey: string;
} {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = Math.floor(minute % 60);
  const period = hours < 12 ? "morning" : hours < 15 ? "noon" : "evening";

  return {
    time: `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")}`,
    periodKey: `common.clock.${period}`,
  };
}

// The same arithmetic as a block but against two instants, clamped to the drawn hours — an absence
// from yesterday evening is not drawn off the top. Null when it does not touch the day.
export function periodPosition(
  startsAt: string,
  endsAt: string,
  isoDate: string,
): { readonly top: string; readonly height: string } | null {
  const zone = clinicTimeZone();
  const start = minutesFromLocalMidnight(new Date(startsAt), isoDate, zone);
  const end = minutesFromLocalMidnight(new Date(endsAt), isoDate, zone);

  const clampedStart = Math.max(GRID_START_MINUTE, start);
  const clampedEnd = Math.min(GRID_END_MINUTE, end);

  if (clampedEnd <= clampedStart) {
    return null;
  }

  return {
    top: `${((clampedStart - GRID_START_MINUTE) / GRID_MINUTES) * 100}%`,
    height: `${((clampedEnd - clampedStart) / GRID_MINUTES) * 100}%`,
  };
}

export function blockPosition(appointment: CalendarAppointment): {
  readonly top: string;
  readonly height: string;
} {
  const start = minutesOf(appointment.startsAt);
  const clampedStart = Math.max(GRID_START_MINUTE, Math.min(GRID_END_MINUTE, start));
  const clampedEnd = Math.max(
    clampedStart,
    Math.min(GRID_END_MINUTE, start + appointment.durationMinutes),
  );

  return {
    top: `${((clampedStart - GRID_START_MINUTE) / GRID_MINUTES) * 100}%`,
    height: `${(blockMinutes(clampedEnd - clampedStart) / GRID_MINUTES) * 100}%`,
  };
}

// `offsetY` is measured against the column, so it is already relative to the top of the day.
// Clamped, so a drag past the bottom books the last slot.
export function minuteFromOffset(offsetY: number, columnHeight: number): number {
  const ratio = Math.max(0, Math.min(1, offsetY / Math.max(columnHeight, 1)));
  const raw = GRID_START_MINUTE + ratio * GRID_MINUTES;
  const snapped = Math.round(raw / DRAG_STEP_MINUTES) * DRAG_STEP_MINUTES;

  return Math.max(GRID_START_MINUTE, Math.min(GRID_END_MINUTE - DRAG_STEP_MINUTES, snapped));
}

export const instantAt = (isoDate: string, minute: number): string =>
  instantFromLocal(isoDate, minute, clinicTimeZone()).toISOString();

export const gridHours = (): number[] =>
  Array.from(
    { length: (GRID_END_MINUTE - GRID_START_MINUTE) / 60 + 1 },
    (_, index) => GRID_START_MINUTE + index * 60,
  );
