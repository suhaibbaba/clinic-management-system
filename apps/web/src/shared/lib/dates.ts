import { minutesFromLocalMidnight, localDate, instantFromLocal } from "@clinic/shared";
import { clinicTimeZone } from "@web/shared/lib/clinic-zone";
import i18n from "@web/i18n";

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

export function toTimeLabel(minute: number): string {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = Math.floor(minute % 60);
  const marker = i18n.t(hours < 12 ? "common.clock.am" : "common.clock.pm");

  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${marker}`;
}

export const instantAt = (isoDate: string, minute: number): string =>
  instantFromLocal(isoDate, minute, clinicTimeZone()).toISOString();
