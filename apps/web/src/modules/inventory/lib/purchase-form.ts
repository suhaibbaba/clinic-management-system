import { SHOPPING_LIST_PATH, type PurchaseMode } from "@web/modules/inventory/constants";
import {
  DISCOUNT_KIND,
  PURCHASE_BACKDATE_DAYS,
  PURCHASE_MAX_BACKDATE_DAYS,
  addDays,
  computeInvoice,
  formatMinorUnits,
  toMinorUnits,
  toThousandths,
  type DiscountKind,
  type InvoiceResult,
  type ItemPrice,
  type Money,
  type PostPurchaseInput,
  type PurchaseRequest,
  type UpdatePurchaseRequestInput,
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

export function pricedTotals(draft: PurchaseDraft): InvoiceResult | null {
  return previewTotals({
    ...draft,
    discountValue: "",
    charges: "",
    lines: draft.lines.map((line) => ({ ...line, discountValue: "", gift: false })),
  });
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

export function linesFromOrder(request: PurchaseRequest): PurchaseLineDraft[] {
  return request.lines.map((line) => ({
    ...blankLine(line.id, line.itemId),
    quantity: line.quantity,
  }));
}

const QUANTITY = /^\d+(\.\d{1,3})?$/;

export function expectedPrice(prices: readonly ItemPrice[], supplierId: string): Money | null {
  const priced = prices.filter((price) => price.unitPrice !== null);
  const pick =
    priced.find((price) => filled(supplierId) && price.supplierId === supplierId) ?? priced[0];

  if (!pick?.unitPrice) {
    return null;
  }

  return formatMinorUnits(
    Math.round((toMinorUnits(pick.unitPrice) * 1000) / toThousandths(pick.unitsPer)),
  );
}

export function lineCost(quantity: string, price: Money | null): Money | null {
  const q = quantity.trim();

  if (price === null || !QUANTITY.test(q)) {
    return null;
  }

  return formatMinorUnits(Math.round((toThousandths(q) * toMinorUnits(price)) / 1000));
}

export function orderReady(lines: readonly PurchaseLineDraft[]): boolean {
  const items = lines.map((line) => line.itemId);

  return (
    lines.length > 0 &&
    lines.every((line) => filled(line.itemId) && Number(line.quantity || "0") > 0) &&
    new Set(items).size === items.length
  );
}

export function toOrderInput(draft: PurchaseDraft, neededBy: string): UpdatePurchaseRequestInput {
  return {
    supplierId: filled(draft.supplierId) ? draft.supplierId : null,
    neededBy: filled(neededBy) ? neededBy : null,
    note: filled(draft.note) ? draft.note.trim() : null,
    lines: draft.lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity.trim() })),
  };
}

export function purchaseMode(
  value: string | null,
  mayReceive: boolean,
  mayOrder: boolean,
): PurchaseMode {
  if (!mayReceive) {
    return "order";
  }

  return value === "order" && mayOrder ? "order" : "receive";
}

export interface PurchaseCounts {
  readonly lines: number;
  readonly quantity: number;
  readonly free: number;
  readonly gifts: number;
}

export function purchaseCounts(lines: readonly PurchaseLineDraft[]): PurchaseCounts {
  return lines.reduce<PurchaseCounts>(
    (counts, line) => ({
      lines: counts.lines + (line.itemId === "" ? 0 : 1),
      quantity: counts.quantity + Number(line.quantity || "0"),
      free: counts.free + Number(line.freeQuantity || "0"),
      gifts: counts.gifts + (line.gift ? 1 : 0),
    }),
    { lines: 0, quantity: 0, free: 0, gifts: 0 },
  );
}

export function lineReady(
  line: PurchaseLineDraft,
  withInvoice: boolean,
  minExpiry: string,
): boolean {
  return (
    line.itemId !== "" &&
    (line.expiryDate === "" || line.expiryDate >= minExpiry) &&
    Number(line.quantity || "0") + Number(line.freeQuantity || "0") > 0 &&
    (!withInvoice || line.gift || filled(line.unitPrice))
  );
}

export function linesFromLinks(values: readonly string[], key: () => string): PurchaseLineDraft[] {
  return values.flatMap((value) => {
    const [itemId = "", quantity = ""] = value.split(":");

    return itemId === ""
      ? []
      : [{ ...blankLine(key(), itemId), quantity: Number(quantity) > 0 ? quantity : "" }];
  });
}

export function returnTarget(value: string | null): string | null {
  return value === SHOPPING_LIST_PATH || value?.startsWith(`${SHOPPING_LIST_PATH}?`) === true
    ? value
    : null;
}

export function itemPurchaseLink(itemId: string, supplierId: string | null): string {
  const params = new URLSearchParams({ item: itemId });

  if (supplierId) {
    params.set("supplier", supplierId);
  }

  return `/inventory/purchases/new?${params.toString()}`;
}

export function earliestPurchaseDate(today: string, mayBackdate: boolean): string {
  return addDays(today, -(mayBackdate ? PURCHASE_MAX_BACKDATE_DAYS : PURCHASE_BACKDATE_DAYS));
}
