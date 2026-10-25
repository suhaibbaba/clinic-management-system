import type { PersonName } from "@clinic/shared";
import { personName } from "@shared/text/person-name";
import { clockTime, shortDate } from "@shared/time/zone";

const DATE_LOCALE = "ar-SY-u-ca-gregory-nu-latn";

const stripBidiMarks = (value: string): string => value.replace(/[\u200e\u200f]/g, "");

const pad = (value: number): string => String(value).padStart(2, "0");

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);

  return isoDate(date);
}

export function daysFromToday(iso: string): number {
  const from = new Date(`${todayIso()}T12:00:00`).getTime();
  const to = new Date(`${iso}T12:00:00`).getTime();

  return Math.round((to - from) / 86_400_000);
}

export interface DayChip {
  readonly date: string;
  readonly label: string;
  readonly weekday: string;
  readonly dayNumber: string;
}

const noon = (iso: string): Date => new Date(`${iso}T12:00:00`);

export function weekTitle(from: string, to: string): string {
  return `\u2066${shortDate(from)} – ${shortDate(to)}\u2069`;
}

const weekdayOf = (at: Date): string =>
  stripBidiMarks(at.toLocaleDateString(DATE_LOCALE, { weekday: "long" }));

export function dayTitle(iso: string): string {
  return `${weekdayOf(noon(iso))} ${shortDate(iso)}`;
}

export function dayChips(from: string, count: number, maxDaysAhead: number): DayChip[] {
  const chips: DayChip[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const date = addDays(from, offset);

    if (daysFromToday(date) > maxDaysAhead) {
      break;
    }

    const at = noon(date);
    const distance = daysFromToday(date);
    const weekday = weekdayOf(at);

    chips.push({
      date,
      label: distance === 0 ? "today" : distance === 1 ? "tomorrow" : weekday,
      weekday: weekday.replace(/^ال/, ""), // i18n-allow: the Arabic article dropped from a weekday name the platform formatted
      dayNumber: pad(at.getDate()),
    });
  }

  return chips;
}

let clinicOffsetMinutes: number | undefined;

export function learnClinicOffset(startsAt: string, localLabel: string): void {
  const [hours = "0", minutes = "0"] = localLabel.split(":");
  const local = Number(hours) * 60 + Number(minutes);

  const at = new Date(startsAt);
  const utc = at.getUTCHours() * 60 + at.getUTCMinutes();

  let offset = local - utc;
  if (offset > 720) offset -= 1440;
  if (offset < -720) offset += 1440;

  clinicOffsetMinutes = offset;
}

const inClinicZone = (iso: string): Date => {
  const at = new Date(iso);

  return clinicOffsetMinutes === undefined
    ? at
    : new Date(at.getTime() + (clinicOffsetMinutes + at.getTimezoneOffset()) * 60_000);
};

export function formatTime(iso: string): string {
  const at = inClinicZone(iso);

  return clockTime(at.getHours() * 60 + at.getMinutes());
}

export function formatLongDate(iso: string): string {
  const at = inClinicZone(iso);

  return `${weekdayOf(at)} ${shortDate(isoDate(at))}`;
}

export function clinicDate(iso: string): string {
  return isoDate(inClinicZone(iso));
}

export function bookingName(name: PersonName | null | undefined): string {
  return personName(name, "ar");
}
