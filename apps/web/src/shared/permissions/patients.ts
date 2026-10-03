import { RULE } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

const isClinical = (can: Can): boolean => can(RULE.PATIENTS_CLINICAL);

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

export const canOpenPatientFile = (can: Can): boolean => can("patients.findOne");

export const canDeleteVisit = (can: Can): boolean => can("visits.remove");

export const canDeleteProcedure = (can: Can): boolean => can("procedures.remove");
