import { DISCOUNT_KIND } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  blankLine,
  previewTotals,
  toPostPurchase,
  type PurchaseDraft,
} from "@web/modules/inventory/lib/purchase-form";

const draft = (overrides: Partial<PurchaseDraft> = {}): PurchaseDraft => ({
  supplierId: "s-1",
  date: "2026-10-28",
  withInvoice: true,
  supplierRef: "INV-778",
  discountKind: DISCOUNT_KIND.PERCENT,
  discountValue: "5",
  charges: "20",
  taxRate: "",
  taxAmount: "",
  paidNow: "500",
  paymentMethod: "cash",
  note: "",
  lines: [
    { ...blankLine("a", "composite"), quantity: "10", freeQuantity: "2", unitPrice: "45" },
    { ...blankLine("b", "lidocaine"), quantity: "4", unitPrice: "120", discountValue: "10" },
    { ...blankLine("c", "gloves"), quantity: "10", unitPrice: "25" },
    { ...blankLine("d", "sample"), quantity: "1", gift: true },
  ],
  ...overrides,
});

describe("the purchase form", () => {
  it("previews the same totals the server will post", () => {
    expect(previewTotals(draft())).toMatchObject({ subtotal: "1132.00", total: "1095.40" });
  });

  it("sends an invoice with its discounts, free units, gift and payment", () => {
    const body = toPostPurchase(draft(), "r-1");

    expect(body.invoice).toEqual({
      supplierRef: "INV-778",
      discount: { kind: DISCOUNT_KIND.PERCENT, value: "5" },
      charges: "20",
    });
    expect(body.lines[1]).toMatchObject({ discount: { kind: DISCOUNT_KIND.PERCENT, value: "10" } });
    expect(body.lines[3]).toEqual({ itemId: "sample", quantity: "1", gift: true });
    expect(body).toMatchObject({ paidNow: "500", paymentMethod: "cash", requestId: "r-1" });
  });

  it("sends a receipt only when there is no supplier or no invoice", () => {
    const noSupplier = toPostPurchase(draft({ supplierId: "" }), "r-2");
    const later = toPostPurchase(draft({ withInvoice: false }), "r-3");

    expect(noSupplier.invoice).toBeNull();
    expect(noSupplier).not.toHaveProperty("paidNow");
    expect(later.invoice).toBeNull();
    expect(later.lines[1]).not.toHaveProperty("discount");
  });

  it("has no preview until a line has an item and a quantity", () => {
    expect(previewTotals(draft({ lines: [blankLine("x")] }))).toBeNull();
  });
});
