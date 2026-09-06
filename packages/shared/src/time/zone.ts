/**
 * Local wall-clock time ↔ absolute instants, in the clinic's own timezone.
 *
 * A clinic's opening hours are `09:00`, and an appointment is stored as a
 * `timestamptz`. Something has to join the two, and it must not be *either*
 * machine's own zone: a VPS in UTC would put a Damascus clinic's morning three
 * hours out on the server, and a laptop with a wrong clock would do the same
 * in the browser. Both sides ask the clinic.
 *
 * In `@clinic/shared` rather than in either app because the API and the web
 * calendar must agree to the minute — a slot the API says is 09:00 and the
 * grid draws at 06:00 is the kind of disagreement that ends with a patient
 * arriving at the wrong hour.
 *
 * `Intl` does the work, so there is no timezone library and no data to keep up
 * to date beyond the platform's own.
 */

/** IANA zone used when a clinic has not set one (see `clinicTimeZone`). */
export const DEFAULT_TIME_ZONE = 'Asia/Damascus';

const partsFormatter = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = partsFormatter.get(timeZone);

  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatter.set(timeZone, cached);
  }

  return cached;
}

interface LocalParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = formatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // `hour12: false` still renders midnight as 24 in some ICU versions.
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  };
}

/** How far ahead of UTC the zone is at that instant, in minutes. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = localParts(instant, timeZone);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return (asIfUtc - instant.getTime()) / 60_000;
}

/**
 * The instant at which a local date and a minute-of-day occur.
 *
 * Two passes, because the offset depends on the instant we are trying to find:
 * guess with the offset in force at the naive time, then re-read the offset at
 * the guess and correct. That converges everywhere except inside a DST gap,
 * where the requested wall-clock time does not exist at all and any answer is
 * an invention; this one lands on the far side of the gap.
 */
export function instantFromLocal(isoDate: string, minuteOfDay: number, timeZone: string): Date {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);
  const naive = Date.UTC(year, month - 1, day) + minuteOfDay * 60_000;

  const firstGuess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000);

  return new Date(naive - offsetMinutes(firstGuess, timeZone) * 60_000);
}

/** Minutes from local midnight of `isoDate`. Negative before it, >1440 after. */
export function minutesFromLocalMidnight(instant: Date, isoDate: string, timeZone: string): number {
  const midnight = instantFromLocal(isoDate, 0, timeZone);

  return (instant.getTime() - midnight.getTime()) / 60_000;
}

/** The local calendar date an instant falls on, as `YYYY-MM-DD`. */
export function localDate(instant: Date, timeZone: string): string {
  const { year, month, day } = localParts(instant, timeZone);

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 0 = Sunday … 6 = Saturday, matching `DaySchedule.weekday`. */
export function localWeekday(isoDate: string, timeZone: string): number {
  // Read off noon rather than midnight: a zone that shifts at midnight can put
  // 00:00 on the previous day, and no zone shifts at noon.
  const noon = instantFromLocal(isoDate, 12 * 60, timeZone);
  const parts = localParts(noon, timeZone);

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

/** `YYYY-MM-DD` a whole number of days after another. */
export function addDays(isoDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}
