import { type CreateAppointmentInput, GENDERS, type PatientPhoneClash } from "@clinic/shared";
import { ApiError } from "@web/shared/lib/api-error";

export interface PickedPatient {
  readonly id: string;
  readonly fullName: string;
  readonly phone: string;
  readonly fileNumber: string;
  readonly profileIncomplete?: boolean;
}

export interface PatientDraft {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly gender?: string;
  readonly dateOfBirth?: string;
}

export type PatientChoice =
  | { readonly kind: "existing"; readonly patient: PickedPatient }
  | { readonly kind: "new"; readonly draft: PatientDraft };

export function toPatientRef(
  choice: PatientChoice,
): Pick<CreateAppointmentInput, "patientId" | "newPatient"> {
  if (choice.kind === "existing") {
    return { patientId: choice.patient.id };
  }

  const { firstName, lastName, phone, dateOfBirth } = choice.draft;
  const gender = GENDERS.find((option) => option === choice.draft.gender);

  return {
    newPatient: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      ...(gender && { gender }),
      ...(dateOfBirth && { dateOfBirth }),
    },
  };
}

export function patientPhoneClash(error: unknown): PickedPatient | null {
  if (!(error instanceof ApiError) || error.statusCode !== 409) {
    return null;
  }

  return (error.payload as Partial<PatientPhoneClash> | undefined)?.existingPatient ?? null;
}

export const isDraftComplete = (choice: PatientChoice | null): boolean =>
  choice === null
    ? false
    : choice.kind === "existing" ||
      (choice.draft.firstName.trim() !== "" &&
        choice.draft.lastName.trim() !== "" &&
        choice.draft.phone.trim() !== "");
