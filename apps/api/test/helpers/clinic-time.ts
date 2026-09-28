import { DEFAULT_TIME_ZONE, instantFromLocal } from "@clinic/shared";

export function atClinic(day: string, time: string): Date {
  const [hours, minutes] = time.split(":");

  return instantFromLocal(day, Number(hours) * 60 + Number(minutes), DEFAULT_TIME_ZONE);
}
