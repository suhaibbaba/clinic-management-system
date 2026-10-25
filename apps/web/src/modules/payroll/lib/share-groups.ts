import {
  addMoney,
  subtractMoney,
  type SettlementTotals,
  type SettlementTreatment,
} from "@clinic/shared";

export interface ShareGroups {
  readonly collected: readonly SettlementTreatment[];
  readonly waiting: readonly SettlementTreatment[];
}

export interface ShareSplit {
  readonly share: string;
  readonly ready: string;
  readonly waiting: string;
  readonly readyPercent: number;
}

export function groupByCollection(treatments: readonly SettlementTreatment[]): ShareGroups {
  return {
    collected: treatments.filter((row) => row.collectedPercent >= 100),
    waiting: treatments.filter((row) => row.collectedPercent < 100),
  };
}

export function shareSplit(totals: SettlementTotals): ShareSplit {
  const share = Number(totals.doctorShare);

  return {
    share: totals.doctorShare,
    ready: totals.payable,
    waiting: subtractMoney(totals.doctorShare, totals.payable),
    readyPercent: share > 0 ? Math.round((Number(totals.payable) / share) * 100) : 0,
  };
}

export function sumMoney(
  treatments: readonly SettlementTreatment[],
  pick: (row: SettlementTreatment) => string,
): string {
  return treatments.reduce((total, row) => addMoney(total, pick(row)), "0.00");
}
