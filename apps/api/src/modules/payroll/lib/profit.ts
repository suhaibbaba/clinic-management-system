import {
  addMoney,
  formatMinorUnits,
  subtractMoney,
  toMinorUnits,
  type MonthProfit,
} from "@clinic/shared";

const ZERO = "0.00";

export interface MonthOutgoings {
  readonly collections: string;
  readonly labs: string;
  readonly stock: string;
  readonly purchaseVariance: string;
  readonly expenses: string;
}

export function percentOf(amount: string, percent: number): string {
  const minor = toMinorUnits(amount);

  return formatMinorUnits(minor <= 0 ? 0 : Math.round((minor * percent) / 100));
}

export const sumMoney = (amounts: readonly string[]): string =>
  amounts.reduce((total, amount) => addMoney(total, amount), ZERO);

export function profitBeforeShares(
  outgoings: MonthOutgoings,
  staffPay: string,
  doctorShares: string,
): Omit<MonthProfit, "profitShares" | "ownerProfit"> {
  const costs = sumMoney([
    staffPay,
    doctorShares,
    outgoings.labs,
    outgoings.stock,
    outgoings.purchaseVariance,
    outgoings.expenses,
  ]);

  return {
    collections: addMoney(outgoings.collections, ZERO),
    staffPay: addMoney(staffPay, ZERO),
    doctorShares: addMoney(doctorShares, ZERO),
    labs: addMoney(outgoings.labs, ZERO),
    stock: addMoney(outgoings.stock, ZERO),
    purchaseVariance: addMoney(outgoings.purchaseVariance, ZERO),
    expenses: addMoney(outgoings.expenses, ZERO),
    beforeShares: subtractMoney(outgoings.collections, costs),
  };
}

export function withProfitShares(
  before: Omit<MonthProfit, "profitShares" | "ownerProfit">,
  profitShares: string,
): MonthProfit {
  return {
    ...before,
    profitShares: addMoney(profitShares, ZERO),
    ownerProfit: subtractMoney(before.beforeShares, profitShares),
  };
}
