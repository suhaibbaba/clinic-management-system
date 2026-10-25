import { describe, expect, it } from "vitest";
import {
  groupHours,
  orDefault,
  pick,
  timeLabel,
  titleLines,
  weekdayName,
} from "@web/site/lib/text";

describe("site text", () => {
  it("falls back to Arabic when the English is empty, and to the default when both are", () => {
    expect(pick({ ar: "خدماتنا", en: "" }, "en")).toBe("خدماتنا");
    expect(pick({ ar: "خدماتنا", en: "Services" }, "en")).toBe("Services");
    expect(orDefault({ ar: "", en: "" }, "ar", "fallback")).toBe("fallback");
  });

  it("splits a hero title into its lead line and the accented rest", () => {
    expect(titleLines("رعاية متكاملة\nلصحة وجمال أسنانك")).toEqual([
      "رعاية متكاملة",
      "لصحة وجمال أسنانك",
    ]);
    expect(titleLines("One line")).toEqual(["One line", ""]);
    expect(titleLines("A\r\n\nB\nC")).toEqual(["A", "B C"]);
  });
});

describe("opening hours", () => {
  const day = { ranges: [{ start: "08:00", end: "20:00" }] };

  it("groups neighbouring days with the same hours, from Saturday", () => {
    const rows = groupHours([
      { weekday: 6, ...day },
      { weekday: 0, ...day },
      { weekday: 1, ...day },
      { weekday: 4, ranges: [{ start: "08:00", end: "14:00" }] },
    ]);

    expect(rows.map((row) => row.days)).toEqual([[6, 0, 1], [2, 3], [4], [5]]);
    expect(rows[1]?.ranges).toEqual([]);
  });

  it("names a weekday with Sunday as zero", () => {
    expect(weekdayName(0, "en")).toBe("Sunday");
    expect(weekdayName(6, "en")).toBe("Saturday");
  });

  it("writes a clock time with Latin digits in both languages", () => {
    expect(timeLabel("20:30")).toBe("8:30 PM");
    expect(timeLabel("08:00")).toBe("8:00 AM");
  });
});
