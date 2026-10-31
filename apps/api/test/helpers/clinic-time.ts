import { DEFAULT_TIME_ZONE, instantFromLocal, localDate } from "@clinic/shared";

export function atClinic(day: string, time: string): Date {
  const [hours, minutes] = time.split(":");

  return instantFromLocal(day, Number(hours) * 60 + Number(minutes), DEFAULT_TIME_ZONE);
}

export const clinicToday = (): string => localDate(new Date(), DEFAULT_TIME_ZONE);

export const clinicMonth = (): string => clinicToday().slice(0, 7);
