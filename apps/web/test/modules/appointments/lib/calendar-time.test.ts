import { describe, expect, it } from "vitest";
import { buildQueue } from "@web/modules/appointments/lib/calendar-time";
import { addDays, instantAt, minutesOf, startOfWeek, weekDates } from "@web/shared/lib/dates";

describe("calendar time", () => {
  describe("weeks", () => {
    it("snaps to Sunday, the way the API does", () => {
      expect(startOfWeek("2026-09-06")).toBe("2026-09-06");
      expect(startOfWeek("2026-09-09")).toBe("2026-09-06");
      expect(startOfWeek("2026-09-12")).toBe("2026-09-06");
    });

    it("lists seven consecutive days", () => {
      const days = weekDates("2026-09-09");

      expect(days).toHaveLength(7);
      expect(days[0]).toBe("2026-09-06");
      expect(days.at(-1)).toBe("2026-09-12");
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
