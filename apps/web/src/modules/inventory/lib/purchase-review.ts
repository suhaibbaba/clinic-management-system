import {
  PURCHASE_REVIEW_KIND,
  type MarkReviewedInput,
  type PurchaseReviewEntry,
} from "@clinic/shared";

export function reviewSelection(entries: readonly PurchaseReviewEntry[]): MarkReviewedInput {
  return {
    receipts: entries
      .filter((entry) => entry.kind === PURCHASE_REVIEW_KIND.RECEIPT)
      .map((entry) => entry.id),
    invoices: entries
      .filter((entry) => entry.kind === PURCHASE_REVIEW_KIND.INVOICE)
      .map((entry) => entry.id),
  };
}
