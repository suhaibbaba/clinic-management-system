import { describe, expect, it } from "vitest";
import { LAB_ORDER_STATUS, type LabOrderStatus } from "@clinic/shared";
import { afterLabCost, labCostOf, labCostOfAll, labOrdersOnTooth } from "@web/shared/lib/lab-cost";

const order = (
  performedProcedureId: string | null,
  price: string,
  status: LabOrderStatus = LAB_ORDER_STATUS.SENT,
  costKept = false,
  teeth: number[] = [25],
) => ({ performedProcedureId, price, status, costKept, teeth });

describe("lab cost", () => {
  it("adds the orders linked to a treatment, drafts included", () => {
    const orders = [
      order("crown", "1000.00", LAB_ORDER_STATUS.DRAFT),
      order("crown", "200.00"),
      order("other", "50.00"),
      order(null, "70.00"),
    ];

    expect(labCostOf(orders, "crown")).toBe("1200.00");
    expect(labCostOfAll(orders, ["crown", "other"])).toBe("1250.00");
  });

  it("leaves out a cancelled order unless its cost was kept", () => {
    const orders = [
      order("crown", "300.00", LAB_ORDER_STATUS.CANCELLED),
      order("crown", "40.00", LAB_ORDER_STATUS.CANCELLED, true),
    ];

    expect(labCostOf(orders, "crown")).toBe("40.00");
  });

  it("takes the lab cost off the price, below zero when the lab costs more", () => {
    expect(afterLabCost("1500.00", "1200.00")).toBe("300.00");
    expect(afterLabCost("1000.00", "1200.00")).toBe("-200.00");
  });

  it("finds the orders on a tooth", () => {
    const orders = [
      order(null, "1.00", undefined, false, [24, 25]),
      order(null, "1.00", undefined, false, [11]),
    ];

    expect(labOrdersOnTooth(orders, 25)).toHaveLength(1);
  });
});
