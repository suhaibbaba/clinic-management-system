import {
  missingProfileFields,
  type Money,
  type PatientClinicalView,
  type PatientPublicView,
  type PatientView,
} from "@clinic/shared";
import type { PatientRow } from "@api/modules/patients/lib/patient-access";

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
    assignedDoctorId: row.assignedDoctorId,
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
    assignedDoctorId: row.assignedDoctorId,
    profileIncomplete: isProfileIncomplete(row),
  };
}

export function toRoleView(row: PatientRow, clinical: boolean, balance?: Money): PatientView {
  const view = clinical ? toClinicalView(row) : toPublicView(row);

  return balance === undefined ? view : { ...view, balance };
}
