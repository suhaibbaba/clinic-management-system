import { describe, expect, it } from "vitest";
import { shareSteps } from "@web/modules/earnings/lib/share-steps";

const breakdown = {
  tax: "0.00",
  overhead: "0.00",
  materialCost: "500.00",
  net: "500.00",
  sharePercent: 50,
};

describe("shareSteps", () => {
  it("has nothing to show when the clinic keeps the calculation to itself", () => {
    expect(shareSteps({ revenue: "1000.00", workPercent: 100 })).toBeNull();
  });

  it("takes the lab cost off the amount before the doctor's percentage", () => {
    expect(shareSteps({ revenue: "1000.00", workPercent: 100, breakdown })).toEqual({
      beforeNet: [{ key: "materials", amount: "500.00" }],
      net: "500.00",
      sharePercent: 50,
      workPercent: 100,
      afterShare: [],
    });
  });

  it("takes the lab cost off the doctor's share when the doctor bears it", () => {
    expect(
      shareSteps({
        revenue: "1000.00",
        workPercent: 100,
        breakdown: { ...breakdown, net: "1000.00" },
      }),
    ).toMatchObject({
      beforeNet: [],
      net: "1000.00",
      afterShare: [{ key: "materials", amount: "500.00" }],
    });
  });

  it("lists tax and overhead before the lab cost and skips what is zero", () => {
    const steps = shareSteps({
      revenue: "1000.00",
      workPercent: 100,
      breakdown: { ...breakdown, tax: "160.00", materialCost: "0.00", net: "840.00" },
    });

    expect(steps?.beforeNet).toEqual([{ key: "tax", amount: "160.00" }]);
    expect(steps?.afterShare).toEqual([]);
  });
});
