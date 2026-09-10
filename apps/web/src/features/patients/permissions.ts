import { USER_ROLE, type UserRole } from '@clinic/shared';

// The ROLES.md patients and billing rows in one place, so they are reviewable against the spec.
// Hiding a control is cosmetic — the API refuses either way.

const isClinical = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR;

// The chart shows procedures and chart marks: admin and doctor. A technician's read is limited to
// lab-linked rows, which the chart cannot express.
export const canViewChart = isClinical;

export const canRecordProcedure = isClinical;

// Admin and doctor read charges; a technician gets no financial patient data. Kept here so the rule
// survives the route opening up.
export const canSeePrices = isClinical;

// A receptionist response never carries an attachment key or URL, and a technician's read is
// limited to lab-linked attachments.
export const canSeeAttachments = isClinical;

/** Uploading and removing images: the same roles that may write the record. */
export const canManageAttachments = isClinical;

/** Only an admin may soft-delete a medical or financial record, and nothing is hard-deleted. */
export const canDelete = (role: UserRole): boolean => role === USER_ROLE.ADMIN;

export const canCreatePatient = (role: UserRole): boolean => role !== USER_ROLE.TECHNICIAN;

export const seesClinicalPatientFields = isClinical;

// The route guard is built from this list, and so is every link that would lead to it — a name
// linking to a page the reader is bounced off is worse than plain text.
export const PATIENT_FILE_ROLES = [
  USER_ROLE.ADMIN,
  USER_ROLE.DOCTOR,
  USER_ROLE.RECEPTIONIST,
] as const;

export const canOpenPatientFile = (role: UserRole | undefined): boolean =>
  role !== undefined && (PATIENT_FILE_ROLES as readonly UserRole[]).includes(role);
