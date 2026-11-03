import type { CreateLabOrderInput } from "@clinic/shared";

export interface LabWorkDraft {
  readonly key: string;
  readonly labId: string;
  readonly labName: string;
  readonly workTypeId: string;
  readonly workTypeName: string;
  readonly price: string;
  readonly shade: string;
  readonly expectedAt: string;
  readonly instructions: string;
  readonly files: readonly File[];
}

export interface LabWorkTarget {
  readonly patientId: string;
  readonly doctorId: string;
  readonly performedProcedureId: string;
}

export interface LabWorkOrder {
  readonly order: CreateLabOrderInput;
  readonly files: readonly File[];
}

export const emptyLabWork = (key: string): LabWorkDraft => ({
  key,
  labId: "",
  labName: "",
  workTypeId: "",
  workTypeName: "",
  price: "",
  shade: "",
  expectedAt: "",
  instructions: "",
  files: [],
});

export const isLabWorkReady = (draft: LabWorkDraft): boolean => draft.labId !== "";

export const wholeAmount = (amount: string): string => String(Math.round(Number(amount)));

export function labWorkOrder(
  draft: LabWorkDraft,
  target: LabWorkTarget,
  mayPrice: boolean,
): LabWorkOrder {
  return {
    order: {
      ...target,
      labId: draft.labId,
      ...(draft.workTypeId !== "" && { workTypeId: draft.workTypeId }),
      ...(mayPrice && draft.price.trim() !== "" && { price: draft.price.trim() }),
      ...(draft.shade.trim() !== "" && { shade: draft.shade.trim() }),
      ...(draft.expectedAt !== "" && { expectedAt: draft.expectedAt }),
      ...(draft.instructions.trim() !== "" && { instructions: draft.instructions.trim() }),
    },
    files: draft.files,
  };
}
