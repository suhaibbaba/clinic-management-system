import type { CreateLabOrderInput } from "@clinic/shared";

export interface LabWorkDraft {
  readonly key: string;
  readonly labId: string;
  readonly workTypeId: string;
  readonly price: string;
  readonly shade: string;
  readonly expectedAt: string;
  readonly instructions: string;
}

export interface LabWorkTarget {
  readonly patientId: string;
  readonly doctorId: string;
  readonly performedProcedureId: string;
}

export const emptyLabWork = (key: string): LabWorkDraft => ({
  key,
  labId: "",
  workTypeId: "",
  price: "",
  shade: "",
  expectedAt: "",
  instructions: "",
});

export const isLabWorkReady = (draft: LabWorkDraft): boolean => draft.labId !== "";

export function labWorkOrder(
  draft: LabWorkDraft,
  target: LabWorkTarget,
  mayPrice: boolean,
): CreateLabOrderInput {
  return {
    ...target,
    labId: draft.labId,
    ...(draft.workTypeId !== "" && { workTypeId: draft.workTypeId }),
    ...(mayPrice && draft.price.trim() !== "" && { price: draft.price.trim() }),
    ...(draft.shade.trim() !== "" && { shade: draft.shade.trim() }),
    ...(draft.expectedAt !== "" && { expectedAt: draft.expectedAt }),
    ...(draft.instructions.trim() !== "" && { instructions: draft.instructions.trim() }),
  };
}

export const wholeAmount = (amount: string): string => String(Math.round(Number(amount)));
