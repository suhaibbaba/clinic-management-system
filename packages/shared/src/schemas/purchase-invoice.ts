import { formatMinorUnits, toMinorUnits } from "@shared/schemas/money";
import { formatThousandths, toThousandths } from "@shared/schemas/quantity";

export const DISCOUNT_KIND = {
  PERCENT: "percent",
  AMOUNT: "amount",
} as const;
export type DiscountKind = (typeof DISCOUNT_KIND)[keyof typeof DISCOUNT_KIND];

export interface Discount {
  readonly kind: DiscountKind;
  readonly value: string;
}

export interface InvoiceLineInput {
  readonly quantity: string;
  readonly freeQuantity?: string | undefined;
  readonly unitPrice: string;
  readonly discount?: Discount | undefined;
  readonly gift?: boolean | undefined;
}

export interface InvoiceInput {
  readonly lines: readonly InvoiceLineInput[];
  readonly discount?: Discount | undefined;
  readonly charges?: string | undefined;
}

export interface InvoiceLineResult {
  readonly gross: string;
  readonly lineDiscount: string;
  readonly net: string;
  readonly allocation: string;
  readonly cost: string;
  readonly units: string;
  readonly unitCost: string;
}

export interface InvoiceResult {
  readonly lines: readonly InvoiceLineResult[];
  readonly subtotal: string;
  readonly invoiceDiscount: string;
  readonly charges: string;
  readonly total: string;
}

export const INVOICE_ERROR = {
  DISCOUNT_ABOVE_LINE: "invoice_discount_above_line",
  DISCOUNT_ABOVE_SUBTOTAL: "invoice_discount_above_subtotal",
  NO_UNITS: "invoice_line_without_units",
} as const;

export class InvoiceMathError extends Error {
  constructor(readonly code: (typeof INVOICE_ERROR)[keyof typeof INVOICE_ERROR]) {
    super(code);
  }
}

export function roundDiv(numerator: number, denominator: number): number {
  const negative = numerator < 0 !== denominator < 0;
  const a = Math.abs(numerator);
  const b = Math.abs(denominator);
  const rounded = Math.floor((2 * a + b) / (2 * b));

  return negative ? -rounded : rounded;
}

function percentBasisPoints(value: string): number {
  const [whole = "0", fraction = ""] = value.trim().split(".");

  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

function discountMinor(discount: Discount | undefined, baseMinor: number): number {
  if (!discount) {
    return 0;
  }

  return discount.kind === DISCOUNT_KIND.PERCENT
    ? roundDiv(baseMinor * percentBasisPoints(discount.value), 10_000)
    : toMinorUnits(discount.value);
}

export function formatUnitCost(tenThousandths: number): string {
  const negative = tenThousandths < 0;
  const absolute = Math.abs(tenThousandths);
  const whole = Math.floor(absolute / 10_000);
  const fraction = String(absolute % 10_000).padStart(4, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function unitCostOf(costMinor: number, unitsThousandths: number): string {
  return unitsThousandths === 0
    ? "0.0000"
    : formatUnitCost(roundDiv(costMinor * 100 * 1000, unitsThousandths));
}

export function computeInvoice(input: InvoiceInput): InvoiceResult {
  const lines = input.lines.map((line) => {
    const units = toThousandths(line.quantity) + toThousandths(line.freeQuantity ?? "0");

    if (units <= 0) {
      throw new InvoiceMathError(INVOICE_ERROR.NO_UNITS);
    }

    const gross = line.gift
      ? 0
      : roundDiv(toThousandths(line.quantity) * toMinorUnits(line.unitPrice), 1000);
    const lineDiscount = line.gift ? 0 : discountMinor(line.discount, gross);

    if (lineDiscount > gross) {
      throw new InvoiceMathError(INVOICE_ERROR.DISCOUNT_ABOVE_LINE);
    }

    return { units, gross, lineDiscount, net: gross - lineDiscount };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.net, 0);
  const invoiceDiscount = discountMinor(input.discount, subtotal);

  if (invoiceDiscount > subtotal) {
    throw new InvoiceMathError(INVOICE_ERROR.DISCOUNT_ABOVE_SUBTOTAL);
  }

  const charges = toMinorUnits(input.charges ?? "0");
  const adjustment = charges - invoiceDiscount;
  const shares = lines.map((line) =>
    subtotal === 0 ? 0 : roundDiv(adjustment * line.net, subtotal),
  );
  const largest = lines.reduce(
    (best, line, index) => (line.net > (lines[best]?.net ?? -1) ? index : best),
    0,
  );
  shares[largest] = (shares[largest] ?? 0) + adjustment - shares.reduce((a, b) => a + b, 0);

  return {
    lines: lines.map((line, index) => {
      const allocation = shares[index] ?? 0;
      const cost = line.net + allocation;

      return {
        gross: formatMinorUnits(line.gross),
        lineDiscount: formatMinorUnits(line.lineDiscount),
        net: formatMinorUnits(line.net),
        allocation: formatMinorUnits(allocation),
        cost: formatMinorUnits(cost),
        units: formatThousandths(line.units),
        unitCost: unitCostOf(cost, line.units),
      };
    }),
    subtotal: formatMinorUnits(subtotal),
    invoiceDiscount: formatMinorUnits(invoiceDiscount),
    charges: formatMinorUnits(charges),
    total: formatMinorUnits(subtotal - invoiceDiscount + charges),
  };
}
