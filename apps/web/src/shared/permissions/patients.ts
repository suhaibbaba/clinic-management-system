import { USER_ROLE, type UserRole } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

const isClinical = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.VISITING_DOCTOR;

export const canViewChart = isClinical;

export const canSeePrices = isClinical;

export const seesClinicalPatientFields = isClinical;

export const canRecordProcedure = (can: Can): boolean => can("procedures.create");

export const canManageAttachments = (can: Can): boolean => can("patient-attachments.presignUpload");

export const canDeleteAttachment = (can: Can): boolean => can("attachments.remove");

export const canWritePrescription = (can: Can): boolean => can("prescriptions.create");

export const canDeletePrescription = (can: Can): boolean => can("prescriptions.remove");

export const canCreatePatient = (can: Can): boolean => can("patients.create");

export const canEditPatient = (can: Can): boolean => can("patients.update");

export const canDeletePatient = (can: Can): boolean => can("patients.remove");

export const PATIENT_FILE_ROLES = [
  USER_ROLE.ADMIN,
  USER_ROLE.DOCTOR,
  USER_ROLE.VISITING_DOCTOR,
  USER_ROLE.RECEPTIONIST,
] as const;

export const canOpenPatientFile = (role: UserRole | undefined): boolean =>
  role !== undefined && (PATIENT_FILE_ROLES as readonly UserRole[]).includes(role);

export const canCreatePlan = (can: Can): boolean => can("treatment-plans.create");

export const canEditPlan = (can: Can): boolean => can("treatment-plans.update");

export const canDeletePlan = (can: Can): boolean => can("treatment-plans.remove");

export const canAddPlanItem = (can: Can): boolean => can("treatment-plans.addItem");

export const canEditPlanItem = (can: Can): boolean => can("plan-items.update");

export const canDeletePlanItem = (can: Can): boolean => can("plan-items.remove");

export const canConvertPlanItem = (can: Can): boolean => can("plan-items.convert");

export const canDeleteVisit = (can: Can): boolean => can("visits.remove");

export const canDeleteProcedure = (can: Can): boolean => can("procedures.remove");
