import type { StockCountLine } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { countChanges, countDifference } from "@web/modules/inventory/lib/stock-count";

const line = (itemId: string, counted: string | null): StockCountLine => ({
  itemId,
  itemName: itemId,
  unit: "box",
  expected: "10",
  current: "9",
  counted,
  difference: null,
});

describe("stock count helpers", () => {
  it("saves only the counts that changed, and a cleared field as not counted", () => {
    expect(
      countChanges([line("a", "7"), line("b", null), line("c", "3")], {
        a: "7.0",
        b: "4",
        c: "",
      }),
    ).toEqual([
      { itemId: "b", counted: "4" },
      { itemId: "c", counted: null },
    ]);
  });

  it("measures the difference against what the shelf holds now", () => {
    expect(countDifference("7", "9")).toBe("-2");
    expect(countDifference("", "9")).toBeNull();
  });
});
