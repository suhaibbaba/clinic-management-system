import { foldDigits, type DrugRegimen } from "@clinic/shared";

export interface RegimenInput {
  perDose: string;
  timesPerDay: string;
  days: string;
}

export const EMPTY_REGIMEN_INPUT: RegimenInput = { perDose: "", timesPerDay: "", days: "" };

function toNumber(value: string): number | null {
  const clean = foldDigits(value).trim().replace(/[٫,،]/g, ".");

  return clean === "" ? null : Number(clean);
}

export function toRegimen(input: RegimenInput): DrugRegimen {
  return {
    perDose: toNumber(input.perDose),
    timesPerDay: toNumber(input.timesPerDay),
    days: toNumber(input.days),
  };
}

export function toRegimenInput(regimen: DrugRegimen): RegimenInput {
  return {
    perDose: regimen.perDose == null ? "" : String(regimen.perDose),
    timesPerDay: regimen.timesPerDay == null ? "" : String(regimen.timesPerDay),
    days: regimen.days == null ? "" : String(regimen.days),
  };
}

export function withRegimen(
  meta: Record<string, unknown> | undefined,
  regimen: DrugRegimen,
): Record<string, unknown> {
  const kept = Object.entries(meta ?? {}).filter(([key]) => !(key in regimen));
  const given = Object.entries(regimen).filter(([, value]) => value != null);

  return Object.fromEntries([...kept, ...given]);
}
