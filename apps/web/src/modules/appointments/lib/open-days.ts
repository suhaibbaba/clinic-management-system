import type { WeeklySchedule } from "@clinic/shared";
import { addDays, weekdayOf } from "@web/shared/lib/dates";

export type OpenWeekdays = ReadonlySet<number> | null;

export function openWeekdays(hours: WeeklySchedule | undefined): OpenWeekdays {
  const open = (hours ?? []).filter((day) => day.ranges.length > 0).map((day) => day.weekday);

  return open.length === 0 ? null : new Set(open);
}

export const isOpenDay = (day: string, open: OpenWeekdays): boolean =>
  open === null || open.has(weekdayOf(day));

export function openDaysOf(days: readonly string[], open: OpenWeekdays): string[] {
  const kept = days.filter((day) => isOpenDay(day, open));

  return kept.length === 0 ? [...days] : kept;
}

export function stepOpenDay(day: string, direction: -1 | 1, open: OpenWeekdays): string {
  let next = addDays(day, direction);

  for (let tries = 0; tries < 6 && !isOpenDay(next, open); tries += 1) {
    next = addDays(next, direction);
  }

  return next;
}
