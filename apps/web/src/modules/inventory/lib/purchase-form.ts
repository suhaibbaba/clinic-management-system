import {
  DISCOUNT_KIND,
  computeInvoice,
  type DiscountKind,
  type InvoiceResult,
  type PostPurchaseInput,
  type PurchaseRequest,
} from "@clinic/shared";

export interface PurchaseLineDraft {
  readonly key: string;
  readonly itemId: string;
  readonly requestLineId?: string | undefined;
  readonly packSizeId?: string | undefined;
  readonly quantity: string;
  readonly freeQuantity: string;
  readonly unitPrice: string;
  readonly discountKind: DiscountKind;
  readonly discountValue: string;
  readonly gift: boolean;
  readonly batchNo: string;
  readonly expiryDate: string;
}

export interface PurchaseDraft {
  readonly supplierId: string;
  readonly date: string;
  readonly withInvoice: boolean;
  readonly supplierRef: string;
  readonly discountKind: DiscountKind;
  readonly discountValue: string;
  readonly charges: string;
  readonly taxRate: string;
  readonly taxAmount: string;
  readonly paidNow: string;
  readonly paymentMethod: string;
  readonly note: string;
  readonly lines: readonly PurchaseLineDraft[];
}

const filled = (value: string): boolean => value.trim() !== "";

export const blankLine = (key: string, itemId = ""): PurchaseLineDraft => ({
  key,
  itemId,
  quantity: "",
  freeQuantity: "",
  unitPrice: "",
  discountKind: DISCOUNT_KIND.PERCENT,
  discountValue: "",
  gift: false,
  batchNo: "",
  expiryDate: "",
});

export const invoices = (draft: PurchaseDraft): boolean =>
  draft.withInvoice && filled(draft.supplierId);

const discountOf = (kind: DiscountKind, value: string) =>
  filled(value) && Number(value) !== 0 ? { kind, value: value.trim() } : undefined;

export function previewTotals(draft: PurchaseDraft): InvoiceResult | null {
  const lines = draft.lines.filter((line) => filled(line.itemId) && filled(line.quantity));

  if (lines.length === 0) {
    return null;
  }

  try {
    return computeInvoice({
      lines: lines.map((line) => ({
        quantity: line.quantity.trim(),
        freeQuantity: filled(line.freeQuantity) ? line.freeQuantity.trim() : undefined,
        unitPrice: filled(line.unitPrice) ? line.unitPrice.trim() : "0",
        discount: discountOf(line.discountKind, line.discountValue),
        gift: line.gift,
      })),
      discount: discountOf(draft.discountKind, draft.discountValue),
      charges: filled(draft.charges) ? draft.charges.trim() : undefined,
    });
  } catch {
    return null;
  }
}

export function toPostPurchase(draft: PurchaseDraft, requestId: string): PostPurchaseInput {
  const withInvoice = invoices(draft);
  const discount = discountOf(draft.discountKind, draft.discountValue);
  const paid = filled(draft.paidNow) && Number(draft.paidNow) > 0;

  return {
    ...(filled(draft.supplierId) && { supplierId: draft.supplierId }),
    date: draft.date,
    requestId,
    ...(filled(draft.note) && { note: draft.note.trim() }),
    lines: draft.lines
      .filter((line) => filled(line.itemId))
      .map((line) => {
        const lineDiscount = discountOf(line.discountKind, line.discountValue);

        return {
          itemId: line.itemId,
          ...(line.requestLineId && { requestLineId: line.requestLineId }),
          ...(line.packSizeId && { packSizeId: line.packSizeId }),
          quantity: line.quantity.trim(),
          ...(filled(line.freeQuantity) && { freeQuantity: line.freeQuantity.trim() }),
          ...(!line.gift && filled(line.unitPrice) && { unitPrice: line.unitPrice.trim() }),
          ...(withInvoice && lineDiscount && { discount: lineDiscount }),
          ...(withInvoice && line.gift && { gift: true }),
          ...(filled(line.batchNo) && { batchNo: line.batchNo.trim() }),
          ...(filled(line.expiryDate) && { expiryDate: line.expiryDate }),
        };
      }),
    invoice: withInvoice
      ? {
          ...(filled(draft.supplierRef) && { supplierRef: draft.supplierRef.trim() }),
          ...(discount && { discount }),
          ...(filled(draft.charges) && { charges: draft.charges.trim() }),
          ...(filled(draft.taxRate) && { taxRate: draft.taxRate.trim() }),
          ...(filled(draft.taxAmount) && { taxAmount: draft.taxAmount.trim() }),
        }
      : null,
    ...(withInvoice &&
      paid && { paidNow: draft.paidNow.trim(), paymentMethod: draft.paymentMethod }),
  };
}

export function linesFromRequest(request: PurchaseRequest): PurchaseLineDraft[] {
  return request.lines
    .filter((line) => Number(line.open) > 0)
    .map((line) => ({
      ...blankLine(line.id, line.itemId),
      requestLineId: line.id,
      quantity: line.open,
      unitPrice: line.lastPrice ?? "",
    }));
}
