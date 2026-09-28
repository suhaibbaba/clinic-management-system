export const DEFAULT_TIME_ZONE = "Asia/Hebron";

const partsFormatter = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = partsFormatter.get(timeZone);

  if (!cached) {
    cached = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
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
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  };
}

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

export function instantFromLocal(isoDate: string, minuteOfDay: number, timeZone: string): Date {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, day) + minuteOfDay * 60_000;

  const firstGuess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000);

  return new Date(naive - offsetMinutes(firstGuess, timeZone) * 60_000);
}

export function minutesFromLocalMidnight(instant: Date, isoDate: string, timeZone: string): number {
  const midnight = instantFromLocal(isoDate, 0, timeZone);

  return (instant.getTime() - midnight.getTime()) / 60_000;
}

export function localDate(instant: Date, timeZone: string): string {
  const { year, month, day } = localParts(instant, timeZone);

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function localWeekday(isoDate: string, timeZone: string): number {
  const noon = instantFromLocal(isoDate, 12 * 60, timeZone);
  const parts = localParts(noon, timeZone);

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function addDays(isoDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}
