import { clockTime, localDate, minutesFromLocalMidnight } from "@clinic/shared";

export function timeIn(timeZone: string, at: Date): string {
  return clockTime(minutesFromLocalMidnight(at, localDate(at, timeZone), timeZone));
}
