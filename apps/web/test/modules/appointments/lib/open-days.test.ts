import { describe, expect, it } from "vitest";
import {
  isOpenDay,
  openDaysOf,
  openWeekdays,
  stepOpenDay,
} from "@web/modules/appointments/lib/open-days";

const hours = [0, 1, 2, 3, 4, 6].map((weekday) => ({
  weekday,
  ranges: [{ start: "09:00", end: "17:00" }],
}));
const withClosedFriday = [...hours, { weekday: 5, ranges: [] }];

describe("open days", () => {
  it("treats a weekday without ranges as closed", () => {
    const open = openWeekdays(withClosedFriday);

    expect(isOpenDay("2026-10-16", open)).toBe(false);
    expect(isOpenDay("2026-10-17", open)).toBe(true);
  });

  it("keeps every day open when no working hours are set", () => {
    expect(openWeekdays([])).toBeNull();
    expect(openWeekdays(undefined)).toBeNull();
    expect(isOpenDay("2026-10-16", null)).toBe(true);
  });

  it("drops closed days from a week and keeps a week that would be empty", () => {
    const open = openWeekdays(hours);

    expect(openDaysOf(["2026-10-16", "2026-10-17", "2026-10-18"], open)).toEqual([
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(openDaysOf(["2026-10-16"], open)).toEqual(["2026-10-16"]);
  });

  it("steps over a closed day in both directions", () => {
    const open = openWeekdays(hours);

    expect(stepOpenDay("2026-10-15", 1, open)).toBe("2026-10-17");
    expect(stepOpenDay("2026-10-17", -1, open)).toBe("2026-10-15");
    expect(stepOpenDay("2026-10-17", 1, open)).toBe("2026-10-18");
  });
});
