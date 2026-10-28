import type { MonthProfit } from "@clinic/shared";
import type { BreakdownRow } from "@web/modules/payroll/lib/pay-breakdown";

const COSTS = [
  "staffPay",
  "doctorShares",
  "labs",
  "stock",
  "purchaseVariance",
  "expenses",
] as const;

const isZero = (amount: string): boolean => Number(amount) === 0;

export function profitRows(profit: MonthProfit): BreakdownRow[] {
  return [
    {
      key: "collections",
      label: "finance.rows.collections",
      amount: profit.collections,
      sign: "plus",
    },
    ...COSTS.filter((key) => !isZero(profit[key] ?? "0")).map((key) => ({
      key,
      label: `finance.rows.${key}`,
      amount: profit[key] ?? "0.00",
      sign: "minus" as const,
    })),
    ...(isZero(profit.profitShares)
      ? []
      : [
          {
            key: "beforeShares",
            label: "finance.rows.beforeShares",
            amount: profit.beforeShares,
            sign: "result" as const,
          },
          {
            key: "profitShares",
            label: "finance.rows.profitShares",
            amount: profit.profitShares,
            sign: "minus" as const,
          },
        ]),
    {
      key: "ownerProfit",
      label: "finance.rows.ownerProfit",
      amount: profit.ownerProfit,
      sign: "result",
    },
  ];
}
