import type { Doctor, ProcedureCatalogItem, UserRole } from "@clinic/shared";
import type { JSX } from "react";

import {
  ProcedureForm,
  type ProcedureFormValues,
} from "@web/features/patients/procedures/procedure-form";

export type NewProcedureInput = ProcedureFormValues;

export interface AddProcedureFormProps {
  readonly tooth: number;
  readonly role: UserRole;
  readonly catalog: readonly ProcedureCatalogItem[];
  readonly doctors: readonly Doctor[];
  readonly submitting: boolean;
  readonly onSubmit: (input: NewProcedureInput) => void;
  readonly onCancel: () => void;
}

export function AddProcedureForm({ tooth, ...rest }: AddProcedureFormProps): JSX.Element {
  return <ProcedureForm tooth={tooth} {...rest} />;
}
