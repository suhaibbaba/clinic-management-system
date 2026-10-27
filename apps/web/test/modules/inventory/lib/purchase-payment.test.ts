import { describe, expect, it } from "vitest";
import {
  leftToPay,
  paysMoreThan,
  paysSomething,
  purchaseTotal,
} from "@web/modules/inventory/lib/purchase-payment";

describe("paying at purchase", () => {
  it("totals a purchase from its quantity and unit price", () => {
    expect(purchaseTotal("3", "600")).toBe("1800.00");
    expect(purchaseTotal("2.5", "10")).toBe("25.00");
  });

  it("has no total until both numbers are there", () => {
    expect(purchaseTotal("", "600")).toBeNull();
    expect(purchaseTotal("3", "")).toBeNull();
    expect(purchaseTotal("3", "abc")).toBeNull();
  });

  it("leaves the whole total owed when nothing is paid", () => {
    expect(leftToPay("1800.00", "")).toBe("1800.00");
    expect(leftToPay("1800.00", "900")).toBe("900.00");
    expect(leftToPay("1800.00", "1800")).toBe("0.00");
  });

  it("counts a payment only when an amount above zero is typed", () => {
    expect(paysSomething("")).toBe(false);
    expect(paysSomething("0")).toBe(false);
    expect(paysSomething("500")).toBe(true);
  });

  it("catches a payment larger than the purchase", () => {
    expect(paysMoreThan("1800.00", "1801")).toBe(true);
    expect(paysMoreThan("1800.00", "1800")).toBe(false);
    expect(paysMoreThan("1800.00", "")).toBe(false);
  });
});
