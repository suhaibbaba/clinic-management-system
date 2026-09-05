import type { Doctor, ProcedureCatalogItem, UserRole } from '@clinic/shared';
import type { JSX } from 'react';

import {
  ProcedureForm,
  type ProcedureFormValues,
} from '@web/features/patients/procedures/procedure-form';

/** Kept as the tooth panel's name for the shared form's output. */
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

/**
 * Recording a procedure from the tooth chart.
 *
 * The form itself is shared with the visits tab — see
 * `procedures/procedure-form.tsx`. All this adds is the chart's context: the
 * tooth is fixed, so it is passed in rather than asked for, which is what turns
 * the surface picker on.
 */
export function AddProcedureForm({ tooth, ...rest }: AddProcedureFormProps): JSX.Element {
  return <ProcedureForm tooth={tooth} {...rest} />;
}
