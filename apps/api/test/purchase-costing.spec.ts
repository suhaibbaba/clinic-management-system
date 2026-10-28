import { computeInvoice, DISCOUNT_KIND, INVOICE_ERROR } from "@clinic/shared";
import { averageCost, costIn, costOut } from "@api/modules/inventory/lib/costing";

describe("purchase invoice arithmetic", () => {
  it("reconciles the worked example to the cent", () => {
    const result = computeInvoice({
      lines: [
        { quantity: "10", freeQuantity: "2", unitPrice: "45" },
        {
          quantity: "4",
          unitPrice: "120",
          discount: { kind: DISCOUNT_KIND.PERCENT, value: "10" },
        },
        { quantity: "10", unitPrice: "25" },
        { quantity: "1", unitPrice: "0", gift: true },
      ],
      discount: { kind: DISCOUNT_KIND.PERCENT, value: "5" },
      charges: "20",
    });

    expect(result).toMatchObject({
      subtotal: "1132.00",
      invoiceDiscount: "56.60",
      charges: "20.00",
      total: "1095.40",
    });
    expect(result.lines.map((line) => line.allocation)).toEqual([
      "-14.55",
      "-13.97",
      "-8.08",
      "0.00",
    ]);
    expect(result.lines.map((line) => line.cost)).toEqual(["435.45", "418.03", "241.92", "0.00"]);
    expect(result.lines.map((line) => line.unitCost)).toEqual([
      "36.2875",
      "104.5075",
      "24.1920",
      "0.0000",
    ]);
  });

  it("puts the rounding remainder on the largest line so lines sum to the total", () => {
    const result = computeInvoice({
      lines: [
        { quantity: "1", unitPrice: "10" },
        { quantity: "1", unitPrice: "10" },
        { quantity: "1", unitPrice: "10" },
      ],
      discount: { kind: DISCOUNT_KIND.AMOUNT, value: "10" },
    });

    expect(result.lines.map((line) => line.allocation)).toEqual(["-3.34", "-3.33", "-3.33"]);
    expect(result.total).toBe("20.00");
  });

  it("rounds a percentage to the cent, half up", () => {
    const result = computeInvoice({
      lines: [{ quantity: "3", unitPrice: "0.35" }],
      discount: { kind: DISCOUNT_KIND.PERCENT, value: "12.5" },
    });

    expect(result).toMatchObject({ subtotal: "1.05", invoiceDiscount: "0.13", total: "0.92" });
  });

  it("allows a wholly free invoice and refuses a discount above its base", () => {
    expect(computeInvoice({ lines: [{ quantity: "2", unitPrice: "0", gift: true }] }).total).toBe(
      "0.00",
    );
    expect(() =>
      computeInvoice({
        lines: [{ quantity: "1", unitPrice: "10" }],
        discount: { kind: DISCOUNT_KIND.AMOUNT, value: "11" },
      }),
    ).toThrow(INVOICE_ERROR.DISCOUNT_ABOVE_SUBTOTAL);
    expect(() =>
      computeInvoice({ lines: [{ quantity: "0", freeQuantity: "0", unitPrice: "10" }] }),
    ).toThrow(INVOICE_ERROR.NO_UNITS);
  });
});

describe("moving average cost", () => {
  it("averages a new receipt into what is on the shelf", () => {
    const layers = { onHand: 3000 + 12000, unknown: 0, knownValue: 13200 + 43545 };

    expect(averageCost(layers)).toBe(378300);
    expect(costOut(layers, 1000)).toEqual({ value: -3783, unknown: 0 });
  });

  it("uses unknown-cost stock first and never prices it", () => {
    const layers = { onHand: 5000, unknown: 2000, knownValue: 3000 };

    expect(costOut(layers, 1000)).toEqual({ value: 0, unknown: -1000 });
    expect(costOut(layers, 3000)).toEqual({ value: -1000, unknown: -2000 });
  });

  it("takes exactly the remaining value when the shelf empties", () => {
    const layers = { onHand: 3000, unknown: 0, knownValue: 1000 };

    expect(costOut(layers, 1000)).toEqual({ value: -333, unknown: 0 });
    expect(costOut(layers, 3000)).toEqual({ value: -1000, unknown: 0 });
  });

  it("values found stock at the average, or as unknown when there is none", () => {
    expect(costIn({ onHand: 2000, unknown: 0, knownValue: 900 }, 1000)).toEqual({
      value: 450,
      unknown: 0,
    });
    expect(costIn({ onHand: 0, unknown: 0, knownValue: 0 }, 1000)).toEqual({
      value: 0,
      unknown: 1000,
    });
  });
});
