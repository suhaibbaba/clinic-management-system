import type { DaySchedule, TimeRange, WeeklySchedule } from '@clinic/shared';

// Pure and free of React, so the collapsed summary and the "outside the clinic's hours" check can
// both be tested directly.

// Saturday first, as the region reads it. The numbers are unchanged (0 = Sunday, matching the API);
// only the drawing order moved.
export const WEEKDAYS_FROM_SATURDAY = [6, 0, 1, 2, 3, 4, 5] as const;

export const DEFAULT_RANGE: TimeRange = { start: '09:00', end: '17:00' };

export const rangesFor = (week: WeeklySchedule, weekday: number): TimeRange[] =>
  week.find((day) => day.weekday === weekday)?.ranges ?? [];

export function withDay(week: WeeklySchedule, next: DaySchedule): WeeklySchedule {
  const others = week.filter((day) => day.weekday !== next.weekday);

  return [...others, next].sort((a, b) => a.weekday - b.weekday);
}

// A hyphen with spaces and Latin digits throughout: this renders inside an LTR island, and a dash
// that differs per language would defeat it.
export function daySummary(ranges: readonly TimeRange[], closedLabel: string): string {
  if (ranges.length === 0) {
    return closedLabel;
  }

  return ranges.map((range) => `${range.start} - ${range.end}`).join(' · ');
}

// Latin digits joined by neutral characters: rendered straight into an Arabic paragraph the summary
// comes out back to front. It belongs inside an `<Ltr>`.

/** `09:30` → 570. Assumes the `HH:MM` shape the schema already enforces. */
const toMinutes = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':');

  return Number(hours) * 60 + Number(minutes);
};

// Returns the offending ranges rather than a boolean, and is not a submit-time refusal: moving a
// shift takes two edits, and blocking the first makes the second unreachable.
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

export const weekFitsWithin = (week: WeeklySchedule, bounds: WeeklySchedule): boolean =>
  WEEKDAYS_FROM_SATURDAY.every(
    (weekday) =>
      rangesOutsideBounds(rangesFor(week, weekday), rangesFor(bounds, weekday)).length === 0,
  );
