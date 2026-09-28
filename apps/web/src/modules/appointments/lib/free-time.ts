import { APPOINTMENT_STATUS, type CalendarAppointment } from "@clinic/shared";

export const isReleased = (appointment: CalendarAppointment): boolean =>
  appointment.status === APPOINTMENT_STATUS.CANCELLED ||
  appointment.status === APPOINTMENT_STATUS.NO_SHOW;

const endOf = (appointment: CalendarAppointment): number =>
  Date.parse(appointment.startsAt) + appointment.durationMinutes * 60_000;

export function idleMinutesBefore(list: readonly CalendarAppointment[], index: number): number {
  const current = list[index];

  if (current === undefined || isReleased(current)) {
    return 0;
  }

  const previous = list
    .slice(0, index)
    .filter((entry) => !isReleased(entry))
    .at(-1);

  return previous
    ? Math.max(0, Math.round((Date.parse(current.startsAt) - endOf(previous)) / 60_000))
    : 0;
}
