import { describe, expect, it } from "vitest";
import { planRemaining, planTotal } from "@web/modules/patients/lib/treatment-plans/plan-total";
import { makePlanItem } from "@test/helpers/fixtures";

describe("treatment plan totals", () => {
  it("is zero for an empty plan", () => {
    expect(planTotal([])).toBe("0.00");
  });

  it("sums the quoted prices", () => {
    const items = [
      makePlanItem({ id: "1", estimatedPrice: "40.00" }),
      makePlanItem({ id: "2", estimatedPrice: "45.00" }),
      makePlanItem({ id: "3", estimatedPrice: "250.00" }),
    ];

    expect(planTotal(items)).toBe("335.00");
  });

  it("adds fractional amounts exactly, where floats would not", () => {
    const items = [
      makePlanItem({ id: "1", estimatedPrice: "0.10" }),
      makePlanItem({ id: "2", estimatedPrice: "0.20" }),
    ];

    expect(planTotal(items)).toBe("0.30");
  });

  it("keeps two decimals even when they are zero", () => {
    expect(planTotal([makePlanItem({ estimatedPrice: "7" })])).toBe("7.00");
  });

  it("counts only what is still planned as remaining", () => {
    const items = [
      makePlanItem({ id: "1", estimatedPrice: "40.00", status: "planned" }),
      makePlanItem({ id: "2", estimatedPrice: "45.00", status: "converted" }),
      makePlanItem({ id: "3", estimatedPrice: "250.00", status: "cancelled" }),
    ];

    expect(planTotal(items)).toBe("335.00");
    expect(planRemaining(items)).toBe("40.00");
  });
});
