import {
  PERFORMED_PROCEDURE_STATUS,
  PERFORMED_PROCEDURE_TRANSITIONS,
  addMoney,
  subtractMoney,
  type Money,
  type PerformedProcedure,
  type PerformedProcedureStatus,
} from "@clinic/shared";

export type TreatmentTone = "success" | "warning" | "neutral" | "danger";

export const CREATABLE_STATUSES: readonly PerformedProcedureStatus[] = [
  PERFORMED_PROCEDURE_STATUS.PLANNED,
  PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
  PERFORMED_PROCEDURE_STATUS.DONE,
];

export function statusChoices(
  current: PerformedProcedureStatus | undefined,
): PerformedProcedureStatus[] {
  return current === undefined
    ? [...CREATABLE_STATUSES]
    : [current, ...PERFORMED_PROCEDURE_TRANSITIONS[current]];
}

export function nextStatuses(
  current: PerformedProcedureStatus,
): readonly PerformedProcedureStatus[] {
  return PERFORMED_PROCEDURE_TRANSITIONS[current];
}

export function statusTone(status: PerformedProcedureStatus): TreatmentTone {
  switch (status) {
    case PERFORMED_PROCEDURE_STATUS.DONE:
      return "success";
    case PERFORMED_PROCEDURE_STATUS.IN_PROGRESS:
      return "warning";
    case PERFORMED_PROCEDURE_STATUS.CANCELLED:
      return "danger";
    default:
      return "neutral";
  }
}

export function treatmentTeeth(procedure: Pick<PerformedProcedure, "chartMarks">): number[] {
  return (procedure.chartMarks ?? [])
    .map((mark) => (mark.location as { tooth?: number }).tooth)
    .filter((tooth): tooth is number => typeof tooth === "number");
}

export function treatmentSurfaces(procedure: Pick<PerformedProcedure, "chartMarks">): string[] {
  return (procedure.chartMarks ?? []).flatMap(
    (mark) => (mark.location as { surfaces?: string[] }).surfaces ?? [],
  );
}

export function netPrice(procedure: Pick<PerformedProcedure, "price" | "discount">): Money {
  return subtractMoney(procedure.price, procedure.discount);
}

export function treatmentsTotal(
  procedures: readonly Pick<PerformedProcedure, "price" | "discount" | "status">[],
): Money {
  return procedures
    .filter((procedure) => procedure.status !== PERFORMED_PROCEDURE_STATUS.CANCELLED)
    .reduce<Money>((total, procedure) => addMoney(total, netPrice(procedure)), "0.00");
}

export function newestTreatmentsFirst<
  T extends Pick<PerformedProcedure, "performedAt" | "createdAt">,
>(procedures: readonly T[]): T[] {
  return [...procedures].sort(
    (a, b) => b.performedAt.localeCompare(a.performedAt) || b.createdAt.localeCompare(a.createdAt),
  );
}
