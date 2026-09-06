import {
  instantFromLocal,
  localDate,
  minutesFromLocalMidnight,
  type CalendarAppointment,
} from '@clinic/shared';

import { clinicTimeZone } from '@web/features/appointments/clinic-zone';

/**
 * The day grid's own arithmetic.
 *
 * Kept out of the components because every one of these is a thing that is
 * either right or subtly wrong by fifteen minutes, and a function is testable
 * where a JSX expression is not.
 *
 * Everything is in **minutes from midnight in the clinic's timezone**, using
 * the same helpers the API's slot module uses — not the browser's zone. A
 * receptionist's laptop set to the wrong zone would otherwise draw 09:00 in
 * one place and book it as 06:00 in another, and the calendar would disagree
 * with the availability endpoint about what a day even contains.
 */

/** The grid runs 07:00–22:00: earlier than any clinic opens, later than it shuts. */
export const GRID_START_MINUTE = 7 * 60;
export const GRID_END_MINUTE = 22 * 60;
export const GRID_MINUTES = GRID_END_MINUTE - GRID_START_MINUTE;

/** One hour of grid, in pixels. Everything else is a fraction of it. */
export const HOUR_HEIGHT = 60;

/** Slot granularity when dragging: a clinic books on the quarter hour. */
export const DRAG_STEP_MINUTES = 15;

export const minutesOf = (iso: string): number => {
  const at = new Date(iso);

  return minutesFromLocalMidnight(at, toIsoDate(at), clinicTimeZone());
};

/** `YYYY-MM-DD` for an instant, in the clinic's zone. */
export const toIsoDate = (at: Date): string => localDate(at, clinicTimeZone());

export const todayIso = (): string => toIsoDate(new Date());

export function addDays(isoDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);

  // Plain calendar arithmetic on the date parts, in UTC so no zone can shift
  // the answer by a day.
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Sunday of the week a date falls in — the API snaps weeks the same way. */
export function startOfWeek(isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);

  return addDays(isoDate, -new Date(Date.UTC(year, month - 1, day)).getUTCDay());
}

export const weekDates = (isoDate: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(isoDate), index));

/** `HH:MM` from minutes, for a grid label. */
export function toTimeLabel(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Where a block sits in the grid, as a percentage of the day's height. */
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
    // A floor of a few minutes, so a 5-minute appointment is still readable
    // and still clickable rather than a hairline.
    height: `${(Math.max(clampedEnd - clampedStart, 20) / GRID_MINUTES) * 100}%`,
  };
}

/**
 * The minute a drag landed on, snapped to the booking granularity.
 *
 * `offsetY` is measured against the column, so it is already relative to the
 * top of the day; the caller does not have to know where the column is on the
 * page. Clamped so a drag past the bottom edge books the last slot rather
 * than a time that does not exist.
 */
export function minuteFromOffset(offsetY: number, columnHeight: number): number {
  const ratio = Math.max(0, Math.min(1, offsetY / Math.max(columnHeight, 1)));
  const raw = GRID_START_MINUTE + ratio * GRID_MINUTES;
  const snapped = Math.round(raw / DRAG_STEP_MINUTES) * DRAG_STEP_MINUTES;

  return Math.max(GRID_START_MINUTE, Math.min(GRID_END_MINUTE - DRAG_STEP_MINUTES, snapped));
}

/** A clinic-local date and minute back into the instant the API stores. */
export const instantAt = (isoDate: string, minute: number): string =>
  instantFromLocal(isoDate, minute, clinicTimeZone()).toISOString();

/** Whole hours the grid draws a line and a label for. */
export const gridHours = (): number[] =>
  Array.from(
    { length: (GRID_END_MINUTE - GRID_START_MINUTE) / 60 + 1 },
    (_, index) => GRID_START_MINUTE + index * 60,
  );
