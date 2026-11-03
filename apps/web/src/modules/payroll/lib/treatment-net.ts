import { subtractMoney, type Money, type SettlementTreatment } from "@clinic/shared";

export type NetDeductionKey = "tax" | "overhead" | "materials";

export interface NetDeduction {
  readonly key: NetDeductionKey;
  readonly amount: Money;
}

export interface TreatmentNet {
  readonly deductions: readonly NetDeduction[];
  readonly net: Money;
  readonly doctorPercent: number;
}

type NetSource = Pick<
  SettlementTreatment,
  "revenue" | "tax" | "overhead" | "net" | "clinicSharePercent"
>;

export function treatmentNet(row: NetSource): TreatmentNet {
  const materials = subtractMoney(
    subtractMoney(subtractMoney(row.revenue, row.tax), row.overhead),
    row.net,
  );
  const deductions: NetDeduction[] = [
    { key: "tax", amount: row.tax },
    { key: "overhead", amount: row.overhead },
    { key: "materials", amount: materials },
  ];

  return {
    deductions: deductions.filter((deduction) => Number(deduction.amount) > 0),
    net: row.net,
    doctorPercent: 100 - row.clinicSharePercent,
  };
}
