import { describe, expect, it } from "vitest";
import { countChanges } from "@web/shared/lib/changes";

describe("counting unsaved changes", () => {
  it("counts each changed field once", () => {
    expect(
      countChanges({ name: "a", phone: "1", email: "x" }, { name: "b", phone: "1", email: "y" }),
    ).toBe(2);
  });

  it("counts a schedule day by day, not as one change", () => {
    const week = [
      { day: 0, open: "09:00" },
      { day: 1, open: "09:00" },
      { day: 2, open: "09:00" },
    ];
    const edited = [week[0], { day: 1, open: "10:00" }, { day: 2, open: "11:00" }];

    expect(countChanges({ week }, { week: edited })).toBe(2);
  });

  it("counts a list of names by what was added and removed, whatever the order", () => {
    expect(countChanges(["a", "b"], ["b", "a"])).toBe(0);
    expect(countChanges(["a", "b"], ["b", "c"])).toBe(2);
  });

  it("looks inside nested settings", () => {
    expect(
      countChanges(
        { tiers: { send: "confirm", book: "confirm" } },
        { tiers: { send: "approve", book: "confirm" } },
      ),
    ).toBe(1);
  });

  it("finds nothing when the values match", () => {
    expect(countChanges({ a: [1, 2], b: { c: "d" } }, { a: [1, 2], b: { c: "d" } })).toBe(0);
  });
});
