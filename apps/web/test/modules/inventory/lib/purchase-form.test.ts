import { DISCOUNT_KIND, PURCHASE_REQUEST_STATUS } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  blankLine,
  earliestPurchaseDate,
  itemPurchaseLink,
  lineReady,
  linesFromLinks,
  linesFromRequest,
  previewTotals,
  purchaseCounts,
  returnTarget,
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

  it("takes a line once it has an item, units, a price on an invoice and a far enough expiry", () => {
    const line = { ...blankLine("a", "composite"), quantity: "2", unitPrice: "45" };

    expect(lineReady(line, true, "2026-11-01")).toBe(true);
    expect(lineReady({ ...line, unitPrice: "" }, true, "2026-11-01")).toBe(false);
    expect(lineReady({ ...line, unitPrice: "", gift: true }, true, "2026-11-01")).toBe(true);
    expect(lineReady({ ...line, unitPrice: "" }, false, "2026-11-01")).toBe(true);
    expect(lineReady({ ...line, quantity: "", freeQuantity: "1" }, true, "2026-11-01")).toBe(true);
    expect(lineReady({ ...line, quantity: "" }, true, "2026-11-01")).toBe(false);
    expect(lineReady({ ...line, itemId: "" }, true, "2026-11-01")).toBe(false);
  });

  it("refuses an expiry earlier than the first allowed day", () => {
    const line = { ...blankLine("a", "composite"), quantity: "2", unitPrice: "45" };

    expect(lineReady({ ...line, expiryDate: "2026-10-31" }, true, "2026-11-01")).toBe(false);
    expect(lineReady({ ...line, expiryDate: "2026-11-01" }, true, "2026-11-01")).toBe(true);
  });

  it("starts a line for each linked item, with its quantity when the link gives one", () => {
    let next = 0;
    const key = (): string => `k${++next}`;

    expect(linesFromLinks(["gloves:12", "composite", "", "needles:0"], key)).toEqual([
      { ...blankLine("k1", "gloves"), quantity: "12" },
      { ...blankLine("k2", "composite"), quantity: "" },
      { ...blankLine("k3", "needles"), quantity: "" },
    ]);
  });

  it("returns only to the shopping list, never to an address a link made up", () => {
    expect(returnTarget("/inventory/shopping-list")).toBe("/inventory/shopping-list");
    expect(returnTarget("/inventory/shopping-list?pick=a")).toBe("/inventory/shopping-list?pick=a");
    expect(returnTarget("https://example.com")).toBeNull();
    expect(returnTarget("//example.com/inventory/shopping-list")).toBeNull();
    expect(returnTarget("/inventory/shopping-listing")).toBeNull();
    expect(returnTarget(null)).toBeNull();
  });
});

describe("itemPurchaseLink", () => {
  it("opens the purchase page on the item, with its default supplier when it has one", () => {
    expect(itemPurchaseLink("gloves", "s-1")).toBe(
      "/inventory/purchases/new?item=gloves&supplier=s-1",
    );
    expect(itemPurchaseLink("gloves", null)).toBe("/inventory/purchases/new?item=gloves");
  });
});

describe("earliestPurchaseDate", () => {
  it("reaches 7 days back without the backdate rule and 30 days with it", () => {
    expect(earliestPurchaseDate("2026-10-30", false)).toBe("2026-10-23");
    expect(earliestPurchaseDate("2026-10-30", true)).toBe("2026-09-30");
  });
});
