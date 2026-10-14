import { subtractMoney, type PayrollLine, type SettlementTotals } from "@clinic/shared";
import { includesSalary, includesShare } from "@web/modules/payroll/lib/plans";

export type BreakdownSign = "plus" | "minus" | "result";

export interface BreakdownRow {
  readonly key: string;
  readonly label: string;
  readonly amount: string;
  readonly sign: BreakdownSign;
}

export interface BreakdownGroup {
  readonly key: "share" | "salary" | "total";
  readonly rows: readonly BreakdownRow[];
}

const isZero = (amount: string): boolean => Number(amount) === 0;

function shareRows(line: PayrollLine, totals: SettlementTotals): BreakdownRow[] {
  const waiting = subtractMoney(totals.doctorShare, totals.payable);
  const costs: BreakdownRow[] = [
    { key: "tax", label: "payroll.calc.tax", amount: totals.tax, sign: "minus" },
    { key: "overhead", label: "payroll.calc.overhead", amount: totals.overhead, sign: "minus" },
    { key: "materials", label: "payroll.calc.materials", amount: totals.materials, sign: "minus" },
  ];

  return [
    { key: "revenue", label: "payroll.calc.revenue", amount: totals.revenue, sign: "plus" },
    ...costs.filter((row) => !isZero(row.amount)),
    { key: "net", label: "payroll.calc.net", amount: totals.net, sign: "result" },
    {
      key: "clinicShare",
      label: "payroll.calc.clinicShare",
      amount: totals.clinicShare,
      sign: "minus",
    },
    ...(isZero(waiting)
      ? []
      : [
          {
            key: "doctorShare",
            label: "payroll.calc.doctorShare",
            amount: totals.doctorShare,
            sign: "result" as const,
          },
          {
            key: "waiting",
            label: "payroll.calc.waiting",
            amount: waiting,
            sign: "minus" as const,
          },
        ]),
    { key: "share", label: "payroll.calc.share", amount: line.sharePayable, sign: "result" },
  ];
}

function salaryRows(line: PayrollLine): BreakdownRow[] {
  return [
    ...(includesSalary(line.plan)
      ? [{ key: "base", label: "payroll.calc.salary", amount: line.base, sign: "plus" as const }]
      : []),
    ...(isZero(line.extras)
      ? []
      : [
          {
            key: "extras",
            label: "payroll.calc.bonus",
            amount: line.extras,
            sign: "plus" as const,
          },
        ]),
    ...(isZero(line.cuts)
      ? []
      : [
          {
            key: "cuts",
            label: "payroll.calc.deduction",
            amount: line.cuts,
            sign: "minus" as const,
          },
        ]),
  ];
}

export function payBreakdown(
  line: PayrollLine,
  totals: SettlementTotals | undefined,
): BreakdownGroup[] {
  const share = includesShare(line.plan) && totals ? shareRows(line, totals) : [];
  const salary = salaryRows(line);

  return [
    ...(share.length > 0 ? [{ key: "share" as const, rows: share }] : []),
    ...(salary.length > 0 ? [{ key: "salary" as const, rows: salary }] : []),
    {
      key: "total",
      rows: [
        { key: "expected", label: "payroll.calc.expected", amount: line.expected, sign: "result" },
        { key: "received", label: "payroll.calc.received", amount: line.received, sign: "minus" },
        { key: "owed", label: "payroll.calc.owed", amount: line.owed, sign: "result" },
      ],
    },
  ];
}
