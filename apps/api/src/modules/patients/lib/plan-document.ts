import { type PerformedProcedure } from "@clinic/shared";

export function procedureTeeth(procedure: Pick<PerformedProcedure, "chartMarks">): number[] {
  return (procedure.chartMarks ?? [])
    .map((mark) => (mark.location as { tooth?: number }).tooth)
    .filter((tooth): tooth is number => typeof tooth === "number");
}
