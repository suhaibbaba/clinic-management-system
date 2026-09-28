import { minutesFromLocalMidnight, localDate, instantFromLocal } from "@clinic/shared";
import { clinicTimeZone } from "@web/shared/lib/clinic-zone";

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

export function startOfWeek(isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);

  return addDays(isoDate, -new Date(Date.UTC(year, month - 1, day)).getUTCDay());
}

export const weekDates = (isoDate: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(isoDate), index));

export const instantAt = (isoDate: string, minute: number): string =>
  instantFromLocal(isoDate, minute, clinicTimeZone()).toISOString();

export function dayBounds(from: string, to: string): { from?: string; to?: string } {
  return {
    ...(from !== "" && { from: instantAt(from, 0) }),
    ...(to !== "" && { to: instantAt(addDays(to, 1), 0) }),
  };
}
