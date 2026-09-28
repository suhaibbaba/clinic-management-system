import {
  APPOINTMENT_STATUS,
  type AppointmentStatus,
  type CalendarAppointment,
} from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { idleMinutesBefore, isReleased } from "@web/modules/appointments/lib/free-time";

const at = (
  time: string,
  minutes: number,
  status: AppointmentStatus = APPOINTMENT_STATUS.CONFIRMED,
) =>
  ({
    id: time,
    startsAt: `2026-09-28T${time}:00.000Z`,
    durationMinutes: minutes,
    status,
  }) as CalendarAppointment;

describe("free time between appointments", () => {
  it("measures from the end of the previous appointment", () => {
    const list = [at("09:00", 30), at("10:40", 20)];

    expect(idleMinutesBefore(list, 0)).toBe(0);
    expect(idleMinutesBefore(list, 1)).toBe(70);
  });

  it("looks past a cancelled or missed appointment, and gives none to one", () => {
    const list = [
      at("09:00", 30),
      at("09:30", 30, APPOINTMENT_STATUS.CANCELLED),
      at("10:30", 30, APPOINTMENT_STATUS.NO_SHOW),
      at("11:00", 15),
    ];

    expect(idleMinutesBefore(list, 1)).toBe(0);
    expect(idleMinutesBefore(list, 3)).toBe(90);
    expect(isReleased(list[2] as CalendarAppointment)).toBe(true);
  });

  it("never reports a negative gap for overlapping bookings", () => {
    expect(idleMinutesBefore([at("09:00", 60), at("09:30", 30)], 1)).toBe(0);
  });
});
