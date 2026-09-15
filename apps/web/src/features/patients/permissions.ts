import { USER_ROLE, type UserRole } from '@clinic/shared';

import type { Can } from '@web/features/auth/session';

// Two kinds of question live here. What somebody may *do* is a permission the admin can move, and
// is asked of `can`. What somebody may *see* is the shape of the response the API sent them, and no
// switch moves it — those stay roles.

const isClinical = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR;

// The chart shows procedures and chart marks: admin and doctor. A technician's read is limited to
// lab-linked rows, which the chart cannot express.
export const canViewChart = isClinical;

// Admin and doctor read charges; a technician gets no financial patient data.
export const canSeePrices = isClinical;

// A receptionist response never carries an attachment key or URL, and a technician's read is
// limited to lab-linked attachments.
export const canSeeAttachments = isClinical;

export const seesClinicalPatientFields = isClinical;

export const canRecordProcedure = (can: Can): boolean => can('procedures.create');

/** Uploading an image against the file. */
export const canManageAttachments = (can: Can): boolean => can('patient-attachments.presignUpload');

/** Soft-deleting an attachment; nothing here is ever hard-deleted. */
export const canDeleteAttachment = (can: Can): boolean => can('attachments.remove');

export const canCreatePatient = (can: Can): boolean => can('patients.create');

export const canEditPatient = (can: Can): boolean => can('patients.update');

// The route guard is built from this list, and so is every link that would lead to it — a name
// linking to a page the reader is bounced off is worse than plain text. A route is a role: the
// screens themselves are not permissions a clinic can move.
export const PATIENT_FILE_ROLES = [
  USER_ROLE.ADMIN,
  USER_ROLE.DOCTOR,
  USER_ROLE.RECEPTIONIST,
] as const;

export const canOpenPatientFile = (role: UserRole | undefined): boolean =>
  role !== undefined && (PATIENT_FILE_ROLES as readonly UserRole[]).includes(role);
