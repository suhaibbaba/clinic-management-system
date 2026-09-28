import {
  missingProfileFields,
  type Money,
  type PatientClinicalView,
  type PatientPublicView,
  type PatientView,
  type UserRole,
} from "@clinic/shared";
import type { PatientRow } from "@api/patients/lib/patient-access";
import { PatientAccessService } from "@api/patients/services/patient-access.service";

export const PATIENTS_ENTITY = "patients";

const isProfileIncomplete = (row: PatientRow): boolean => missingProfileFields(row).length > 0;

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
    whatsapp: row.whatsapp,
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
    whatsapp: row.whatsapp,
    dateOfBirth: row.dateOfBirth,
    profileIncomplete: isProfileIncomplete(row),
  };
}

export function toRoleView(row: PatientRow, role: UserRole, balance?: Money): PatientView {
  const view = PatientAccessService.seesClinicalData(role)
    ? toClinicalView(row)
    : toPublicView(row);

  return balance === undefined ? view : { ...view, balance };
}
