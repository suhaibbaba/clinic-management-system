import {
  PURCHASE_DOCUMENT_STATUS,
  PURCHASE_REVIEW_KIND,
  type PurchaseReviewEntry,
} from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { reviewSelection } from "@web/modules/inventory/lib/purchase-review";

const entry = (kind: PurchaseReviewEntry["kind"], id: string): PurchaseReviewEntry => ({
  kind,
  id,
  number: id,
  status: PURCHASE_DOCUMENT_STATUS.POSTED,
  date: "2026-10-28",
  supplierName: null,
  supplierRef: null,
  total: null,
  lines: 1,
  createdByName: null,
  createdAt: "2026-10-28T08:00:00.000Z",
});

describe("reviewSelection", () => {
  it("splits the marked documents into receipts and invoices", () => {
    expect(
      reviewSelection([
        entry(PURCHASE_REVIEW_KIND.RECEIPT, "r-1"),
        entry(PURCHASE_REVIEW_KIND.INVOICE, "i-1"),
        entry(PURCHASE_REVIEW_KIND.RECEIPT, "r-2"),
      ]),
    ).toEqual({ receipts: ["r-1", "r-2"], invoices: ["i-1"] });
  });
});
