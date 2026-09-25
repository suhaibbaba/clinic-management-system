import { USER_ROLE, type UserRole } from "@clinic/shared";
import type { Can } from "@web/features/auth/session";

const isClinical = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.VISITING_DOCTOR;

// The chart shows procedures and chart marks: admin and doctor. A technician's read is limited to
// lab-linked rows, which the chart cannot express.
export const canViewChart = isClinical;

export const canSeePrices = isClinical;

export const seesClinicalPatientFields = isClinical;

export const canRecordProcedure = (can: Can): boolean => can("procedures.create");

/** Uploading an image against the file. */
export const canManageAttachments = (can: Can): boolean => can("patient-attachments.presignUpload");

/** Soft-deleting an attachment; nothing here is ever hard-deleted. */
export const canDeleteAttachment = (can: Can): boolean => can("attachments.remove");

/** Writing or correcting a prescription: admin and doctor. */
export const canWritePrescription = (can: Can): boolean => can("prescriptions.create");

/** A soft delete; admin and doctor by default. */
export const canDeletePrescription = (can: Can): boolean => can("prescriptions.remove");

export const canCreatePatient = (can: Can): boolean => can("patients.create");

export const canEditPatient = (can: Can): boolean => can("patients.update");

/** A soft delete, admin only; nothing is ever hard-deleted. */
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

/** A soft delete, admin by default; the permissions page can widen it. */
export const canDeletePlan = (can: Can): boolean => can("treatment-plans.remove");

export const canAddPlanItem = (can: Can): boolean => can("treatment-plans.addItem");

export const canEditPlanItem = (can: Can): boolean => can("plan-items.update");

export const canDeletePlanItem = (can: Can): boolean => can("plan-items.remove");

export const canConvertPlanItem = (can: Can): boolean => can("plan-items.convert");

/** Soft deletes, admin and doctor by default; a paid-for record is refused by the API. */
export const canDeleteVisit = (can: Can): boolean => can("visits.remove");

export const canDeleteProcedure = (can: Can): boolean => can("procedures.remove");
