import { type NotificationTemplate, minutesFromLocalMidnight, localDate } from "@clinic/shared";

export interface Reminder {
  readonly template: NotificationTemplate;
  readonly leadMs: number;
  readonly setting: "remind24h" | "remind2h";
}

export function timeIn(timeZone: string, at: Date): string {
  const minutes = minutesFromLocalMidnight(at, localDate(at, timeZone), timeZone);
  const hours = Math.floor(minutes / 60);

  return `${String(hours).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;
}
