import {
  addDays,
  instantFromLocal,
  localDate,
  localWeekday,
  minutesFromLocalMidnight,
} from "@clinic/shared";
import {
  computeDaySlots,
  intersectRanges,
  toMinutes,
  toTimeOfDay,
  type BusyInterval,
} from "@api/modules/appointments/lib/slots";

const nine = { start: "09:00", end: "17:00" };
const morning = { start: "09:00", end: "12:00" };
const afternoon = { start: "14:00", end: "17:00" };

const base = {
  clinicRanges: [nine],
  doctorRanges: [nine],
  isClosed: false,
  timeOff: [] as BusyInterval[],
  busy: [] as BusyInterval[],
  durationMinutes: 30,
  stepMinutes: 30,
};

describe("time of day", () => {
  it("round-trips minutes and HH:MM", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("00:00")).toBe(0);
    expect(toTimeOfDay(570)).toBe("09:30");
    expect(toTimeOfDay(0)).toBe("00:00");
    expect(toTimeOfDay(1439)).toBe("23:59");
  });
});

describe("intersectRanges", () => {
  it("keeps only the time both sides are open", () => {
    expect(
      intersectRanges([{ start: "09:00", end: "17:00" }], [{ start: "08:00", end: "13:00" }]),
    ).toEqual([{ start: 540, end: 780 }]);
  });

  it("drops windows that do not meet at all", () => {
    expect(intersectRanges([morning], [afternoon])).toEqual([]);
  });

  it("handles a split day on either side", () => {
    expect(intersectRanges([morning, afternoon], [{ start: "11:00", end: "15:00" }])).toEqual([
      { start: 660, end: 720 },
      { start: 840, end: 900 },
    ]);
  });
});

describe("computeDaySlots", () => {
  it("offers every step that fits inside the working window", () => {
    const { slots, closedReason } = computeDaySlots(base);

    expect(closedReason).toBeNull();
    expect(slots).toHaveLength(16);
    expect(toTimeOfDay(slots[0]!.startMinute)).toBe("09:00");
    expect(toTimeOfDay(slots.at(-1)!.startMinute)).toBe("16:30");
  });

  it("never offers a slot that runs past closing", () => {
    const { slots } = computeDaySlots({ ...base, stepMinutes: 15 });

    expect(slots.every((slot) => slot.endMinute <= toMinutes("17:00"))).toBe(true);
    expect(toTimeOfDay(slots.at(-1)!.startMinute)).toBe("16:30");
  });

  it("marks a booked slot unavailable and leaves the rest alone", () => {
    const { slots } = computeDaySlots({
      ...base,
      busy: [{ startMinute: toMinutes("10:00"), endMinute: toMinutes("10:30") }],
    });

    const at = (time: string) => slots.find((slot) => slot.startMinute === toMinutes(time));

    expect(at("10:00")?.available).toBe(false);
    expect(at("09:30")?.available).toBe(true);
    expect(at("10:30")?.available).toBe(true);
  });

  it("treats a busy interval as half-open, exactly like the database", () => {
    const { slots } = computeDaySlots({
      ...base,
      busy: [{ startMinute: toMinutes("09:30"), endMinute: toMinutes("10:00") }],
    });

    expect(slots.find((slot) => slot.startMinute === toMinutes("10:00"))?.available).toBe(true);
  });

  it("blocks every slot a long appointment covers", () => {
    const { slots } = computeDaySlots({
      ...base,
      busy: [{ startMinute: toMinutes("09:00"), endMinute: toMinutes("11:00") }],
    });

    const blocked = slots.filter((slot) => !slot.available).map((slot) => slot.startMinute);

    expect(blocked).toEqual([
      toMinutes("09:00"),
      toMinutes("09:30"),
      toMinutes("10:00"),
      toMinutes("10:30"),
    ]);
  });

  it("respects a lunch break by intersecting the two schedules", () => {
    const { slots } = computeDaySlots({
      ...base,
      doctorRanges: [morning, afternoon],
    });

    const starts = slots.map((slot) => toTimeOfDay(slot.startMinute));

    expect(starts).toContain("11:30");
    expect(starts).not.toContain("12:00");
    expect(starts).not.toContain("13:30");
    expect(starts).toContain("14:00");
  });

  it("says the clinic is closed rather than returning an empty day", () => {
    expect(computeDaySlots({ ...base, clinicRanges: [] }).closedReason).toBe("clinic_closed");
    expect(computeDaySlots({ ...base, isClosed: true }).closedReason).toBe("clinic_closure");
    expect(computeDaySlots({ ...base, doctorRanges: [] }).closedReason).toBe("doctor_off");
  });

  it("is closed by a dated closure even when the weekday is a working one", () => {
    const closed = computeDaySlots({ ...base, isClosed: true });

    expect(closed.closedReason).toBe("clinic_closure");
    expect(closed.slots).toEqual([]);
  });

  it("subtracts a partial absence and leaves the rest of the day bookable", () => {
    const { slots, closedReason } = computeDaySlots({
      ...base,
      timeOff: [{ startMinute: toMinutes("14:00"), endMinute: toMinutes("18:00") }],
    });

    const at = (time: string) => slots.find((slot) => slot.startMinute === toMinutes(time));

    expect(closedReason).toBeNull();
    expect(at("09:00")?.available).toBe(true);
    expect(at("13:30")?.available).toBe(true);
    expect(at("14:00")?.available).toBe(false);
    expect(at("16:30")?.available).toBe(false);
  });

  it("reports a whole day of absence as time off rather than as fully booked", () => {
    const away = computeDaySlots({
      ...base,
      timeOff: [{ startMinute: 0, endMinute: 24 * 60 }],
    });

    expect(away.closedReason).toBe("doctor_time_off");
    expect(away.slots.every((slot) => !slot.available)).toBe(true);
  });

  it("reports a full diary as full, not as closed", () => {
    const { closedReason, slots } = computeDaySlots({
      ...base,
      busy: [{ startMinute: 0, endMinute: 24 * 60 }],
    });

    expect(closedReason).toBe("fully_booked");
    expect(slots.length).toBeGreaterThan(0);
  });

  it("reports a duration that fits nowhere as full", () => {
    expect(computeDaySlots({ ...base, durationMinutes: 600 }).closedReason).toBe("fully_booked");
  });

  it("says the day is over rather than calling the evening fully booked", () => {
    const finished = computeDaySlots({ ...base, notBeforeMinute: toMinutes("23:00") });

    expect(finished.closedReason).toBe("day_over");
    expect(finished.slots.length).toBeGreaterThan(0);
  });

  it("still calls a genuinely full day fully booked", () => {
    const full = computeDaySlots({
      ...base,
      notBeforeMinute: toMinutes("09:00"),
      busy: [{ startMinute: 0, endMinute: 24 * 60 }],
    });

    expect(full.closedReason).toBe("fully_booked");
  });

  it("leaves earlier slots visible but unbookable once the day is under way", () => {
    const { slots } = computeDaySlots({ ...base, notBeforeMinute: toMinutes("12:00") });

    const at = (time: string) => slots.find((slot) => slot.startMinute === toMinutes(time));

    expect(at("09:00")?.available).toBe(false);
    expect(at("12:00")?.available).toBe(true);
  });

  it("offers each start once when two windows overlap", () => {
    const { slots } = computeDaySlots({
      ...base,
      clinicRanges: [
        { start: "09:00", end: "13:00" },
        { start: "11:00", end: "17:00" },
      ],
    });

    expect(new Set(slots.map((slot) => slot.startMinute)).size).toBe(slots.length);
  });
});

describe("time zone", () => {
  const DAMASCUS = "Asia/Damascus";

  it("maps a local wall-clock time to the right instant", () => {
    expect(instantFromLocal("2026-09-07", 9 * 60, DAMASCUS).toISOString()).toBe(
      "2026-09-07T06:00:00.000Z",
    );
  });

  it("is the inverse of reading an instant back as local minutes", () => {
    const instant = instantFromLocal("2026-09-07", 13 * 60 + 45, DAMASCUS);

    expect(minutesFromLocalMidnight(instant, "2026-09-07", DAMASCUS)).toBe(13 * 60 + 45);
    expect(localDate(instant, DAMASCUS)).toBe("2026-09-07");
  });

  it("does not drift with the server’s own zone", () => {
    const damascus = instantFromLocal("2026-09-07", 9 * 60, DAMASCUS);
    const utc = instantFromLocal("2026-09-07", 9 * 60, "UTC");

    expect(utc.getTime() - damascus.getTime()).toBe(3 * 60 * 60 * 1000);
  });

  it("reads the weekday a local date falls on", () => {
    expect(localWeekday("2026-09-06", DAMASCUS)).toBe(0);
    expect(localWeekday("2026-09-07", DAMASCUS)).toBe(1);
    expect(localWeekday("2026-09-12", DAMASCUS)).toBe(6);
  });

  it("walks days across a month boundary", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-09-07", 7)).toBe("2026-09-14");
  });
});
