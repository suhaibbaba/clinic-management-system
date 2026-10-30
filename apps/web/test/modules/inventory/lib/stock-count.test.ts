import type { StockCountLine } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  countChanges,
  countDifference,
  countProgress,
  savedDetails,
  visibleCountLines,
} from "@web/modules/inventory/lib/stock-count";

const line = (itemId: string, counted: string | null): StockCountLine => ({
  itemId,
  itemName: itemId,
  unit: "box",
  expected: "10",
  current: "9",
  counted,
  difference: null,
  expiryDate: null,
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
      { itemId: "b", counted: "4", expiryDate: null },
      { itemId: "c", counted: null, expiryDate: null },
    ]);
  });

  it("saves a surplus's price and expiry, and the price only for who may see costs", () => {
    const lines = [{ ...line("a", "12"), unitPrice: "2.50" }, line("b", "12")];
    const details = {
      a: { unitPrice: "3", expiryDate: "" },
      b: { unitPrice: "", expiryDate: "2027-05-01" },
    };

    expect(countChanges(lines, { a: "12", b: "12" }, details, true)).toEqual([
      { itemId: "a", counted: "12", expiryDate: null, unitPrice: "3" },
      { itemId: "b", counted: "12", expiryDate: "2027-05-01", unitPrice: null },
    ]);
    expect(countChanges(lines, { a: "12", b: "12" }, details, false)).toEqual([
      { itemId: "b", counted: "12", expiryDate: "2027-05-01" },
    ]);
    expect(countChanges(lines, { a: "12", b: "12" }, savedDetails(lines), true)).toEqual([]);
  });

  it("measures the difference against what the shelf holds now", () => {
    expect(countDifference("7", "9")).toBe("-2");
    expect(countDifference("", "9")).toBeNull();
  });

  it("tallies what is counted, short and over against the shelf now", () => {
    expect(
      countProgress([line("a", null), line("b", null), line("c", null)], { a: "7", b: "12" }, true),
    ).toEqual({ total: 3, counted: 2, shortages: 1, surpluses: 1 });
  });

  it("shows the lines not counted yet, or with a difference, matching the search", () => {
    const lines = [line("gloves", null), line("masks", null), line("gauze", null)];
    const typed = { gloves: "9", masks: "4" };
    const ids = (filter: "all" | "remaining" | "differences", search = "") =>
      visibleCountLines(lines, typed, true, filter, search).map((entry) => entry.itemId);

    expect(ids("remaining")).toEqual(["gauze"]);
    expect(ids("differences")).toEqual(["masks"]);
    expect(ids("all", " G")).toEqual(["gloves", "gauze"]);
  });
});
