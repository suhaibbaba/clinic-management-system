import {
  APPOINTMENT_STATUS,
  APPOINTMENT_TIMING_ERROR,
  appointmentTimingError,
  type AppointmentTiming,
} from "@clinic/shared";

const now = new Date("2026-10-16T09:00:00Z");

const timing = (day: string, startsAt: string): AppointmentTiming => ({
  day,
  today: "2026-10-16",
  startsAt: new Date(startsAt),
  now,
});

describe("appointment timing", () => {
  it("refuses attendance on a day that has not come", () => {
    const tomorrow = timing("2026-10-17", "2026-10-17T08:00:00Z");

    for (const next of [
      APPOINTMENT_STATUS.ARRIVED,
      APPOINTMENT_STATUS.IN_PROGRESS,
      APPOINTMENT_STATUS.COMPLETED,
    ]) {
      expect(appointmentTimingError(next, tomorrow)).toBe(APPOINTMENT_TIMING_ERROR.DAY_NOT_REACHED);
    }
  });

  it("lets a patient arrive early on the day and settles past days", () => {
    expect(
      appointmentTimingError(
        APPOINTMENT_STATUS.ARRIVED,
        timing("2026-10-16", "2026-10-16T12:00:00Z"),
      ),
    ).toBeNull();
    expect(
      appointmentTimingError(
        APPOINTMENT_STATUS.COMPLETED,
        timing("2026-10-10", "2026-10-10T12:00:00Z"),
      ),
    ).toBeNull();
  });

  it("allows a no-show only once the appointment time has passed", () => {
    expect(
      appointmentTimingError(
        APPOINTMENT_STATUS.NO_SHOW,
        timing("2026-10-16", "2026-10-16T12:00:00Z"),
      ),
    ).toBe(APPOINTMENT_TIMING_ERROR.NOT_STARTED);
    expect(
      appointmentTimingError(
        APPOINTMENT_STATUS.NO_SHOW,
        timing("2026-10-16", "2026-10-16T08:30:00Z"),
      ),
    ).toBeNull();
  });

  it("leaves confirming and cancelling a future appointment alone", () => {
    const later = timing("2026-10-20", "2026-10-20T08:00:00Z");

    expect(appointmentTimingError(APPOINTMENT_STATUS.CONFIRMED, later)).toBeNull();
    expect(appointmentTimingError(APPOINTMENT_STATUS.CANCELLED, later)).toBeNull();
  });
});
