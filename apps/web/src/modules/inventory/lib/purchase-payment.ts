import { formatMinorUnits, toMinorUnits, toThousandths, type Money } from "@clinic/shared";

const AMOUNT = /^\d+(\.\d{1,2})?$/;
const QUANTITY = /^\d+(\.\d{1,3})?$/;

export function purchaseTotal(quantity: string, unitPrice: string): Money | null {
  const q = quantity.trim();
  const p = unitPrice.trim();

  if (!QUANTITY.test(q) || !AMOUNT.test(p)) {
    return null;
  }

  return formatMinorUnits(Math.round((toThousandths(q) * toMinorUnits(p)) / 1000));
}

export function leftToPay(total: Money, paidNow: string): Money {
  const paid = paidNow.trim();

  return formatMinorUnits(toMinorUnits(total) - (AMOUNT.test(paid) ? toMinorUnits(paid) : 0));
}

export const paysMoreThan = (total: Money, paidNow: string): boolean =>
  AMOUNT.test(paidNow.trim()) && toMinorUnits(paidNow.trim()) > toMinorUnits(total);

export const paysSomething = (paidNow: string): boolean =>
  AMOUNT.test(paidNow.trim()) && toMinorUnits(paidNow.trim()) > 0;
