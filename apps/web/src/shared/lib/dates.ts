import { minutesFromLocalMidnight, localDate, instantFromLocal } from "@clinic/shared";
import { clinicTimeZone } from "@web/shared/lib/clinic-zone";
import { WORK_WEEK_LAST_DAY } from "@web/shared/constants/dates";

export const minutesOf = (iso: string): number => {
  const at = new Date(iso);

  return minutesFromLocalMidnight(at, toIsoDate(at), clinicTimeZone());
};

export const toIsoDate = (at: Date): string => localDate(at, clinicTimeZone());

export const todayIso = (): string => toIsoDate(new Date());

export function addDays(isoDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export const weekdayOf = (isoDate: string): number => {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

export function workWeekEnd(start: string, today: string): string {
  const end = addDays(start, (WORK_WEEK_LAST_DAY - weekdayOf(start) + 7) % 7);

  return start < today && today <= end ? addDays(today, -1) : end;
}

export const workWeekDates = (start: string, today: string): string[] => {
  const end = workWeekEnd(start, today);
  const days: string[] = [];

  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
  }

  return days;
};

export const nextWorkWeek = (start: string, today: string): string =>
  addDays(workWeekEnd(start, today), 1);

export function previousWorkWeek(start: string): string {
  const end = addDays(start, -1);

  return addDays(end, -((weekdayOf(end) - WORK_WEEK_LAST_DAY - 1 + 7) % 7));
}

export const instantAt = (isoDate: string, minute: number): string =>
  instantFromLocal(isoDate, minute, clinicTimeZone()).toISOString();

export function dayBounds(from: string, to: string): { from?: string; to?: string } {
  return {
    ...(from !== "" && { from: instantAt(from, 0) }),
    ...(to !== "" && { to: instantAt(addDays(to, 1), 0) }),
  };
}
