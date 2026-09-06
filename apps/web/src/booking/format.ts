/**
 * Dates and times for the booking page.
 *
 * The dashboard's `lib/format` is not reused: it belongs to the signed-in
 * bundle, and this page needs a different set — day chips, a weekday name, and
 * one careful piece of arithmetic about *whose* clock a time is on.
 */

/** Gregorian, Arabic labels, Latin digits — the same choice the app makes. */
const DATE_LOCALE = 'ar-SY-u-ca-gregory-nu-latn';

/** The Arabic locale interleaves bidi marks that reorder digits inside an LTR box. */
const stripBidiMarks = (value: string): string => value.replace(/[\u200e\u200f]/g, '');

const pad = (value: number): string => String(value).padStart(2, '0');

/** `YYYY-MM-DD` for a Date, in the browser's own zone. */
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

/** Whole days from today to `iso`, so the chips can stop at `maxDaysAhead`. */
export function daysFromToday(iso: string): number {
  const from = new Date(`${todayIso()}T12:00:00`).getTime();
  const to = new Date(`${iso}T12:00:00`).getTime();

  return Math.round((to - from) / 86_400_000);
}

export interface DayChip {
  readonly date: string;
  /** `الأحد`, or `اليوم` / `غداً` for the two the patient thinks of by name. */
  readonly label: string;
  /** The day of the month, drawn large on the chip. */
  readonly dayNumber: string;
  readonly monthLabel: string;
}

/**
 * The next `count` days, starting today, stopping at the clinic's window.
 *
 * A horizontal strip rather than a calendar: on a phone, seven chips are one
 * thumb-flick and a month grid is a modal. Someone who wants a date three
 * weeks out is a rarer case than the page is designed around, and they can
 * page the strip forward.
 */
export function dayChips(from: string, count: number, maxDaysAhead: number): DayChip[] {
  const chips: DayChip[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const date = addDays(from, offset);

    if (daysFromToday(date) > maxDaysAhead) {
      break;
    }

    const at = new Date(`${date}T12:00:00`);
    const distance = daysFromToday(date);

    chips.push({
      date,
      label:
        distance === 0
          ? 'today'
          : distance === 1
            ? 'tomorrow'
            : stripBidiMarks(at.toLocaleDateString(DATE_LOCALE, { weekday: 'long' })),
      dayNumber: pad(at.getDate()),
      monthLabel: stripBidiMarks(at.toLocaleDateString(DATE_LOCALE, { month: 'short' })),
    });
  }

  return chips;
}

/**
 * The clinic's clock, learned rather than configured.
 *
 * A slot arrives as both a local label (`start: "09:00"`) and an instant
 * (`startsAt`), so one of them is enough to know how far the clinic's zone
 * sits from UTC — and from then on any instant the API returns can be drawn in
 * the clinic's terms rather than in the phone's. It matters for the one case
 * that would otherwise be a silent lie: a patient whose phone is on a
 * different zone than the clinic, who would be told to come at 06:00 for a
 * 09:00 appointment.
 *
 * Until a slot has been seen the browser's own offset is used, which is right
 * for everyone actually near the clinic.
 */
let clinicOffsetMinutes: number | undefined;

export function learnClinicOffset(startsAt: string, localLabel: string): void {
  const [hours = '0', minutes = '0'] = localLabel.split(':');
  const local = Number(hours) * 60 + Number(minutes);

  const at = new Date(startsAt);
  const utc = at.getUTCHours() * 60 + at.getUTCMinutes();

  // Normalised into (−720, 720]: a local time can be on the other side of
  // midnight from UTC, which would otherwise read as a 23-hour offset.
  let offset = local - utc;
  if (offset > 720) offset -= 1440;
  if (offset < -720) offset += 1440;

  clinicOffsetMinutes = offset;
}

/** For the tests, and for a fresh page load. */
export function resetClinicOffset(): void {
  clinicOffsetMinutes = undefined;
}

const inClinicZone = (iso: string): Date => {
  const at = new Date(iso);

  return clinicOffsetMinutes === undefined
    ? at
    : new Date(at.getTime() + (clinicOffsetMinutes + at.getTimezoneOffset()) * 60_000);
};

/** `09:30`, on the clinic's clock. */
export function formatTime(iso: string): string {
  const at = inClinicZone(iso);

  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** `الأحد ٨ سبتمبر` — the way a date is said out loud, not `08/09/2026`. */
export function formatLongDate(iso: string): string {
  return stripBidiMarks(
    inClinicZone(iso).toLocaleDateString(DATE_LOCALE, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );
}

/** The clinic-local `YYYY-MM-DD` an instant falls on. */
export function clinicDate(iso: string): string {
  return isoDate(inClinicZone(iso));
}
