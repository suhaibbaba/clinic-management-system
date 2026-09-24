import type {
  Money,
  PatientClinicalView,
  PatientPublicView,
  PatientView,
  UserRole,
} from "@clinic/shared";
import type { PatientRow } from "@api/patients/patient-access.service";
import { PatientAccessService } from "@api/patients/patient-access.service";

export const PATIENTS_ENTITY = "patients";

// Registered mid-flow and never finished — an appointment taken over the phone, an online booking.
// Derived from the record rather than a column, so completing the file clears it by itself.
const isProfileIncomplete = (row: PatientRow): boolean =>
  row.dateOfBirth === null || row.gender === null;

export function toClinicalView(row: PatientRow): PatientClinicalView {
  return {
    id: row.id,
    clinicId: row.clinicId,
    fileNumber: row.fileNumber,
    fullName: row.fullName,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    phone: row.phone,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    address: row.address,
    nationalId: row.nationalId,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    notes: row.notes,
    profileIncomplete: isProfileIncomplete(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicView(row: PatientRow): PatientPublicView {
  return {
    id: row.id,
    fileNumber: row.fileNumber,
    fullName: row.fullName,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    phone: row.phone,
    dateOfBirth: row.dateOfBirth,
    profileIncomplete: isProfileIncomplete(row),
  };
}

export function toRoleView(row: PatientRow, role: UserRole, balance?: Money): PatientView {
  const view = PatientAccessService.seesClinicalData(role)
    ? toClinicalView(row)
    : toPublicView(row);

  // Absent rather than null for a technician: ROLES.md forbids financial
  // patient data in their responses, and an explicit null is still a field.
  return balance === undefined ? view : { ...view, balance };
}
