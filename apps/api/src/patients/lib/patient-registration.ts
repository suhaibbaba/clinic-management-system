import { type InlinePatientInput } from "@clinic/shared";

export interface PatientRef {
  readonly patientId?: string | undefined;
  readonly newPatient?: InlinePatientInput | undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: string }).code === "23505"
  );
}
