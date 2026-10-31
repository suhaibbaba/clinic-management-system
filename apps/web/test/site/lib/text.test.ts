import { describe, expect, it } from "vitest";
import {
  groupHours,
  heroLines,
  mapEmbed,
  mapsSearchLink,
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

describe("clinic map", () => {
  it("frames the pin when the clinic has coordinates", () => {
    expect(mapEmbed({ lat: 32, lng: 35 }, "Nablus", 0.5)).toContain(
      "openstreetmap.org/export/embed.html?bbox=34.5%2C31.5%2C35.5%2C32.5",
    );
  });

  it("searches the address when there is no pin, and draws nothing without either", () => {
    expect(mapEmbed(null, "Tunis Street, Nablus", 0.01)).toBe(
      "https://maps.google.com/maps?q=Tunis%20Street%2C%20Nablus&z=16&output=embed",
    );
    expect(mapsSearchLink("Rafidia & Co")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Rafidia%20%26%20Co",
    );
    expect(mapEmbed(null, null, 0.01)).toBeNull();
  });
});

describe("heroLines", () => {
  it("keeps the line break the editor wrote", () => {
    expect(heroLines("A B C D\nE")).toEqual(["A B C D", "E"]);
  });

  it("splits a long single line in two", () => {
    expect(heroLines("ابتسامة صحية تبدأ من هنا")).toEqual(["ابتسامة صحية", "تبدأ من هنا"]);
  });

  it("leaves a short title on one line", () => {
    expect(heroLines("Abu Obaid Clinic")).toEqual(["Abu Obaid Clinic", ""]);
  });
});
