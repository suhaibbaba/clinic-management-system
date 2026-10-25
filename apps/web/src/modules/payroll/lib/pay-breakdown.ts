import { subtractMoney, type PayrollLine, type SettlementTotals } from "@clinic/shared";
import { includesSalary, sharesPercent, sharesTreatments } from "@web/modules/payroll/lib/plans";

export type BreakdownSign = "plus" | "minus" | "result";

export interface BreakdownRow {
  readonly key: string;
  readonly label: string;
  readonly amount: string;
  readonly sign: BreakdownSign;
  readonly percent?: number;
}

export interface BreakdownGroup {
  readonly key: "share" | "salary" | "total";
  readonly rows: readonly BreakdownRow[];
}

const isZero = (amount: string): boolean => Number(amount) === 0;

function shareRows(line: PayrollLine, totals: SettlementTotals): BreakdownRow[] {
  const waiting = subtractMoney(totals.doctorShare, totals.payable);
  const allCosts: BreakdownRow[] = [
    { key: "tax", label: "payroll.calc.tax", amount: totals.tax, sign: "minus" },
    { key: "overhead", label: "payroll.calc.overhead", amount: totals.overhead, sign: "minus" },
    { key: "materials", label: "payroll.calc.materials", amount: totals.materials, sign: "minus" },
  ];
  const costs = allCosts.filter((row) => !isZero(row.amount));

  return [
    { key: "revenue", label: "payroll.calc.revenue", amount: totals.revenue, sign: "plus" },
    ...costs,
    ...(costs.length === 0
      ? []
      : [{ key: "net", label: "payroll.calc.net", amount: totals.net, sign: "result" as const }]),
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

function percentRows(line: PayrollLine): BreakdownRow[] {
  return [
    {
      key: "percentBase",
      label: `payroll.calc.bases.${line.shareBasis}`,
      amount: line.percentBase,
      sign: "plus",
    },
    {
      key: "percentShare",
      label: "payroll.calc.percentShare",
      amount: line.percentShare,
      sign: "result",
      percent: line.shareRate,
    },
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
  const share =
    sharesTreatments(line) && totals
      ? shareRows(line, totals)
      : sharesPercent(line)
        ? percentRows(line)
        : [];
  const salary = salaryRows(line);
  const parts = [
    ...(share.length > 0 ? [{ key: "share" as const, rows: share }] : []),
    ...(salary.length > 0 ? [{ key: "salary" as const, rows: salary }] : []),
  ];
  const lastRow = parts.length === 1 ? parts[0]?.rows.at(-1) : undefined;
  const repeatsExpected =
    lastRow?.sign === "result" && Number(lastRow.amount) === Number(line.expected);
  const expected: BreakdownRow[] = repeatsExpected
    ? []
    : [{ key: "expected", label: "payroll.calc.expected", amount: line.expected, sign: "result" }];

  return [
    ...parts,
    {
      key: "total",
      rows: [
        ...expected,
        { key: "received", label: "payroll.calc.received", amount: line.received, sign: "minus" },
        { key: "owed", label: "payroll.calc.owed", amount: line.owed, sign: "result" },
      ],
    },
  ];
}
