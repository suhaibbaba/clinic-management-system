import { describe, expect, it } from "vitest";
import { firstCentered } from "@web/site/lib/carousel";

describe("firstCentered", () => {
  it("opens on the first card until there are neighbours on both sides", () => {
    expect(firstCentered(0)).toBe(0);
    expect(firstCentered(2)).toBe(0);
  });

  it("opens on the middle card", () => {
    expect(firstCentered(3)).toBe(1);
    expect(firstCentered(4)).toBe(1);
    expect(firstCentered(5)).toBe(2);
  });
});
