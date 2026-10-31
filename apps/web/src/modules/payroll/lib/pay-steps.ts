import {
  PAY_BASIS,
  PAYMENT_COLLECTOR,
  addMoney,
  formatMinorUnits,
  subtractMoney,
  toMinorUnits,
  type DoctorSettlement,
  type PayrollLine,
} from "@clinic/shared";
import { includesSalary } from "@web/modules/payroll/lib/plans";
import { sumMoney } from "@web/modules/payroll/lib/share-groups";

export type PayStepKey =
  | "prices"
  | "share"
  | "collected"
  | "collectedShare"
  | "salary"
  | "bonus"
  | "deduction"
  | "paidOut"
  | "held"
  | "remitted";

export interface PayStepPart {
  readonly key: "prices" | "discount" | "tax" | "overhead" | "materials";
  readonly amount: string;
}

export interface PayStep {
  readonly key: PayStepKey;
  readonly amount: string;
  readonly ready?: boolean;
  readonly parts?: readonly PayStepPart[];
  readonly values: Readonly<Record<string, string | number>>;
}

export interface PaySteps {
  readonly steps: readonly PayStep[];
  readonly owed: string;
  readonly owesClinic: boolean;
}

const isZero = (amount: string): boolean => Number(amount) === 0;

function paidToClinic(settlement: DoctorSettlement): string {
  return formatMinorUnits(
    settlement.treatments.reduce(
      (total, row) =>
        total + Math.round((toMinorUnits(row.revenue) * Math.min(row.collectedPercent, 100)) / 100),
      0,
    ),
  );
}

function priceSteps(settlement: DoctorSettlement): PayStep[] {
  const { totals, treatments } = settlement;
  const discount = sumMoney(treatments, (row) => row.discount);
  const deductions: PayStepPart[] = [
    { key: "discount" as const, amount: discount },
    { key: "tax" as const, amount: totals.tax },
    { key: "overhead" as const, amount: totals.overhead },
    { key: "materials" as const, amount: totals.materials },
  ].filter((part) => !isZero(part.amount));
  const parts: PayStepPart[] =
    deductions.length === 0
      ? []
      : [{ key: "prices", amount: addMoney(totals.revenue, discount) }, ...deductions];
  const collected = paidToClinic(settlement);
  const patientsPaid = new Set(
    treatments
      .filter((row) => row.collectedPercent > 0 && Number(row.revenue) > 0)
      .map((row) => row.patientId),
  ).size;
  const follows = settlement.basis === PAY_BASIS.COLLECTED;

  return [
    {
      key: "prices",
      amount: totals.net,
      ...(parts.length > 0 && { parts }),
      values: { count: treatments.length },
    },
    {
      key: "share",
      amount: totals.doctorShare,
      values: { percent: settlement.clinicSharePercent, clinic: totals.clinicShare },
    },
    ...(follows
      ? [
          {
            key: "collected" as const,
            amount: collected,
            ready: true,
            values: {
              count: patientsPaid,
              total: totals.revenue,
              unpaid: subtractMoney(totals.revenue, collected),
            },
          },
          {
            key: "collectedShare" as const,
            amount: totals.payable,
            ready: true,
            values: {
              percent: 100 - settlement.clinicSharePercent,
              waiting: subtractMoney(totals.doctorShare, totals.payable),
            },
          },
        ]
      : []),
  ];
}

const holdsCash = (line: PayrollLine): boolean =>
  line.collector === PAYMENT_COLLECTOR.DOCTOR || !isZero(line.held) || !isZero(line.remitted);

function cashSteps(line: PayrollLine): PayStep[] {
  if (!holdsCash(line)) {
    return [];
  }

  return [
    { key: "held", amount: line.held, values: {} },
    ...(isZero(line.remitted)
      ? []
      : [
          {
            key: "remitted" as const,
            amount: line.remitted,
            ready: true,
            values: { count: line.remittances.length },
          },
        ]),
  ];
}

export function paySteps(line: PayrollLine, settlement: DoctorSettlement): PaySteps {
  const owesClinic = Number(line.owed) < 0;
  const salary: PayStep[] = [
    ...(includesSalary(line.plan)
      ? [{ key: "salary" as const, amount: line.base, values: {} }]
      : []),
    ...(isZero(line.extras) ? [] : [{ key: "bonus" as const, amount: line.extras, values: {} }]),
    ...(isZero(line.cuts) ? [] : [{ key: "deduction" as const, amount: line.cuts, values: {} }]),
  ];

  return {
    steps: [
      ...priceSteps(settlement),
      ...salary,
      {
        key: "paidOut",
        amount: subtractMoney(addMoney(line.received, line.remitted), line.held),
        values: { count: line.payments.length + settlement.payouts.length },
      },
      ...cashSteps(line),
    ],
    owed: owesClinic ? subtractMoney("0.00", line.owed) : line.owed,
    owesClinic,
  };
}
