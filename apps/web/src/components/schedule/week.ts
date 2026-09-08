import type { DaySchedule, TimeRange, WeeklySchedule } from '@clinic/shared';

/**
 * A week of working hours, as arithmetic.
 *
 * Pure and free of React, so the summary a collapsed row shows and the
 * "outside the clinic's hours" check can both be tested directly — and so the
 * accordion is markup rather than markup plus rules.
 */

/**
 * The week as it is read in the region these clinics are in: Saturday first.
 *
 * The **numbers** are unchanged — 0 is Sunday, matching `Date#getDay`, the
 * `DaySchedule.weekday` the API stores, and the slot arithmetic. Only the order
 * they are drawn in moved, which is a rendering decision and stays here rather
 * than becoming a second numbering nothing else shares.
 */
export const WEEKDAYS_FROM_SATURDAY = [6, 0, 1, 2, 3, 4, 5] as const;

/** What a day gets when it is switched on. */
export const DEFAULT_RANGE: TimeRange = { start: '09:00', end: '17:00' };

export const rangesFor = (week: WeeklySchedule, weekday: number): TimeRange[] =>
  week.find((day) => day.weekday === weekday)?.ranges ?? [];

/** The week with one day replaced, kept in weekday order. */
export function withDay(week: WeeklySchedule, next: DaySchedule): WeeklySchedule {
  const others = week.filter((day) => day.weekday !== next.weekday);

  return [...others, next].sort((a, b) => a.weekday - b.weekday);
}

/**
 * What a collapsed row says: `09:00 - 17:00`, both halves of a split shift, or
 * the word for closed.
 *
 * The separator is a hyphen with spaces rather than an en dash, and the whole
 * string is Latin digits and ASCII punctuation, because it is rendered inside
 * an `<Ltr>`-style island — a dash that is a different character in each
 * language would defeat the point of the island.
 */
export function daySummary(ranges: readonly TimeRange[], closedLabel: string): string {
  if (ranges.length === 0) {
    return closedLabel;
  }

  return ranges.map((range) => `${range.start} - ${range.end}`).join(' · ');
}

/**
 * Note for the caller: this string is Latin digits joined by **neutral**
 * characters (the hyphen, the middot). Rendered straight into an Arabic
 * paragraph the bidi algorithm gives those separators to the paragraph and the
 * whole summary comes out back to front. It belongs inside an `<Ltr>`.
 */

/** `09:30` → 570. Assumes the `HH:MM` shape the schema already enforces. */
const toMinutes = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':');

  return Number(hours) * 60 + Number(minutes);
};

/**
 * The parts of `ranges` that fall outside `bounds`.
 *
 * A doctor's hours have to fit inside the clinic's, and this is what says
 * whether they do. It returns the offending ranges rather than a boolean so a
 * message can name them, and it is deliberately **not** a submit-time refusal:
 * somebody moving a shift from the morning to the evening does it in two edits,
 * and blocking the first one makes the second unreachable.
 *
 * Empty bounds mean the clinic is shut that day, so every range is outside —
 * which is the right answer and the one a doctor rostered on a closed day needs
 * to see.
 */
export function rangesOutsideBounds(
  ranges: readonly TimeRange[],
  bounds: readonly TimeRange[],
): readonly TimeRange[] {
  return ranges.filter(
    (range) =>
      !bounds.some(
        (bound) =>
          toMinutes(bound.start) <= toMinutes(range.start) &&
          toMinutes(range.end) <= toMinutes(bound.end),
      ),
  );
}

/** Whether a whole week fits inside another — the form's own guard. */
export const weekFitsWithin = (week: WeeklySchedule, bounds: WeeklySchedule): boolean =>
  WEEKDAYS_FROM_SATURDAY.every(
    (weekday) =>
      rangesOutsideBounds(rangesFor(week, weekday), rangesFor(bounds, weekday)).length === 0,
  );
