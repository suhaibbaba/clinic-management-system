import { describe, expect, it } from "vitest";
import { buildQueue } from "@web/modules/appointments/lib/calendar-time";
import {
  addDays,
  instantAt,
  minutesOf,
  nextWorkWeek,
  previousWorkWeek,
  workWeekDates,
} from "@web/shared/lib/dates";

describe("calendar time", () => {
  describe("weeks", () => {
    it("runs from the start day through the coming Thursday", () => {
      expect(workWeekDates("2026-09-28", "2026-09-28")).toEqual([
        "2026-09-28",
        "2026-09-29",
        "2026-09-30",
        "2026-10-01",
      ]);
      expect(workWeekDates("2026-10-01", "2026-09-28")).toEqual(["2026-10-01"]);
      expect(workWeekDates("2026-10-02", "2026-09-28")).toHaveLength(7);
    });

    it("stops a past week the day before today", () => {
      expect(workWeekDates("2026-09-25", "2026-09-28")).toEqual([
        "2026-09-25",
        "2026-09-26",
        "2026-09-27",
      ]);
    });

    it("steps back and forth without skipping or repeating a day", () => {
      const today = "2026-09-28";

      expect(previousWorkWeek(today)).toBe("2026-09-25");
      expect(previousWorkWeek("2026-09-25")).toBe("2026-09-18");
      expect(nextWorkWeek("2026-09-18", today)).toBe("2026-09-25");
      expect(nextWorkWeek("2026-09-25", today)).toBe(today);
      expect(nextWorkWeek(today, today)).toBe("2026-10-02");
    });

    it("walks days across a month boundary", () => {
      expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
      expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    });
  });

  it("takes a queue's gaps from the availability answer, so a closure is a strip nobody books", () => {
    const queue = buildQueue({
      date: "2026-09-09",
      appointments: [],
      timeOff: [],
      availability: {
        doctorId: "doctor",
        date: "2026-09-09",
        durationMinutes: 15,
        closedReason: "clinic_closure",
        closedNote: "Eid",
        slots: [],
      },
    });

    expect(queue.rows).toEqual([expect.objectContaining({ kind: "blocked", reason: "Eid" })]);
  });

  it("round-trips a minute through an instant and back", () => {
    const iso = instantAt("2026-09-09", 14 * 60 + 30);

    expect(minutesOf(iso)).toBe(14 * 60 + 30);
  });
});
