import { clockTime, localDate, minutesFromLocalMidnight, type ClockFormat } from "@clinic/shared";

export function timeIn(timeZone: string, at: Date, clock: ClockFormat = "12h"): string {
  return clockTime(minutesFromLocalMidnight(at, localDate(at, timeZone), timeZone), clock);
}
