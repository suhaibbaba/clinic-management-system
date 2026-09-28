import { z } from "zod";
import { minutesFromLocalMidnight, localDate } from "@clinic/shared";

export const rejectBookingSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export function timeIn(timeZone: string, at: Date): string {
  const minutes = minutesFromLocalMidnight(at, localDate(at, timeZone), timeZone);
  const hours = Math.floor(minutes / 60);

  return `${String(hours).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;
}
