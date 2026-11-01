import {
  addMoney,
  normalizeArabic,
  subtractMoney,
  type SettlementLineStatus,
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

export type PatientPaidFilter = "partly" | "none";

export function matchesSearch(row: SettlementTreatment, search: string): boolean {
  const needle = normalizeArabic(search.trim().toLowerCase());

  if (needle === "") {
    return true;
  }

  return [row.patientName, row.fileNumber ?? "", row.procedureName].some((text) =>
    normalizeArabic(text.toLowerCase()).includes(needle),
  );
}

export const matchesDoctorPaid = (
  row: SettlementTreatment,
  status: SettlementLineStatus | null,
): boolean => status === null || row.status === status;

export function matchesPatientPaid(
  row: SettlementTreatment,
  filter: PatientPaidFilter | null,
): boolean {
  if (filter === null) {
    return true;
  }

  return filter === "partly" ? row.collectedPercent > 0 : row.collectedPercent === 0;
}

export function pageOf<TRow>(
  rows: readonly TRow[],
  page: number,
  perPage: number,
): { readonly rows: readonly TRow[]; readonly totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, totalPages);

  return { rows: rows.slice((current - 1) * perPage, current * perPage), totalPages };
}
