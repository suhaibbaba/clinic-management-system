import type { DaySchedule, TimeRange, WeeklySchedule } from "@clinic/shared";

export const WEEKDAYS_FROM_SATURDAY = [6, 0, 1, 2, 3, 4, 5] as const;

export const DEFAULT_RANGE: TimeRange = { start: "09:00", end: "17:00" };

export const rangesFor = (week: WeeklySchedule, weekday: number): TimeRange[] =>
  week.find((day) => day.weekday === weekday)?.ranges ?? [];

export function withDay(week: WeeklySchedule, next: DaySchedule): WeeklySchedule {
  const others = week.filter((day) => day.weekday !== next.weekday);

  return [...others, next].sort((a, b) => a.weekday - b.weekday);
}

export function daySummary(ranges: readonly TimeRange[], closedLabel: string): string {
  if (ranges.length === 0) {
    return closedLabel;
  }

  return ranges.map((range) => `${range.start} - ${range.end}`).join(" · ");
}

const toMinutes = (time: string): number => {
  const [hours = "0", minutes = "0"] = time.split(":");

  return Number(hours) * 60 + Number(minutes);
};

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
