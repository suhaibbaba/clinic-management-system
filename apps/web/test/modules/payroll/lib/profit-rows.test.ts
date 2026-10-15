import type { MonthProfit } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { profitRows } from "@web/modules/payroll/lib/profit-rows";

const profit: MonthProfit = {
  collections: "20000.00",
  staffPay: "6000.00",
  doctorShares: "4000.00",
  labs: "0.00",
  stock: "1000.00",
  expenses: "2000.00",
  beforeShares: "7000.00",
  profitShares: "0.00",
  ownerProfit: "7000.00",
};

describe("profitRows", () => {
  it("takes each cost off what patients paid and leaves out costs that come to nothing", () => {
    expect(profitRows(profit).map((row) => [row.key, row.sign])).toEqual([
      ["collections", "plus"],
      ["staffPay", "minus"],
      ["doctorShares", "minus"],
      ["stock", "minus"],
      ["expenses", "minus"],
      ["ownerProfit", "result"],
    ]);
  });

  it("shows the staff's share of profit before what is left for the owner", () => {
    const keys = profitRows({ ...profit, profitShares: "700.00", ownerProfit: "6300.00" }).map(
      (row) => row.key,
    );

    expect(keys.slice(-3)).toEqual(["beforeShares", "profitShares", "ownerProfit"]);
    expect(keys).not.toContain("labs");
  });
});
