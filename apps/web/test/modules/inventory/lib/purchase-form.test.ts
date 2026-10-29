import { DISCOUNT_KIND, PURCHASE_REQUEST_STATUS } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  blankLine,
  linesFromRequest,
  previewTotals,
  purchaseCounts,
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

  it("receives the open part of a request at the supplier's last price", () => {
    const lines = linesFromRequest({
      id: "req",
      number: "PR-2026-0001",
      status: PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED,
      supplierId: "laith",
      supplierName: "Laith",
      supplierPhone: null,
      neededBy: null,
      note: null,
      sentAt: null,
      sentTo: null,
      cancelReason: null,
      createdByName: null,
      createdAt: "2026-10-28T08:00:00.000Z",
      lines: [
        {
          id: "line-1",
          itemId: "gloves",
          itemName: "Gloves",
          unit: "box",
          quantity: "10",
          received: "6",
          open: "4",
          note: null,
          lastPrice: "25.00",
        },
        {
          id: "line-2",
          itemId: "masks",
          itemName: "Masks",
          unit: "box",
          quantity: "2",
          received: "2",
          open: "0",
          note: null,
        },
      ],
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      itemId: "gloves",
      requestLineId: "line-1",
      quantity: "4",
      unitPrice: "25.00",
    });
    expect(toPostPurchase(draft({ lines }), "r-4").lines[0]).toMatchObject({
      requestLineId: "line-1",
    });
  });

  it("sends the pack a line is bought in, and leaves it out for the item's own unit", () => {
    const body = toPostPurchase(
      draft({
        lines: [
          { ...blankLine("a", "gloves"), quantity: "2", unitPrice: "50", packSizeId: "box" },
          { ...blankLine("b", "masks"), quantity: "3", unitPrice: "4", packSizeId: "" },
        ],
      }),
      "r-5",
    );

    expect(body.lines[0]).toMatchObject({ packSizeId: "box", quantity: "2" });
    expect(body.lines[1]).not.toHaveProperty("packSizeId");
  });

  it("counts the lines with an item, their units, the free units and the gifts", () => {
    expect(purchaseCounts([...draft().lines, blankLine("e")])).toEqual({
      lines: 4,
      quantity: 25,
      free: 2,
      gifts: 1,
    });
  });
});
