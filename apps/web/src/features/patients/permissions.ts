import { USER_ROLE, type UserRole } from '@clinic/shared';

/**
 * The ROLES.md patients and billing rows, in one place.
 *
 * Hiding a control is cosmetic — the API refuses the request either way — but
 * keeping the rules here rather than scattered through the components is what
 * makes them reviewable against the spec, and what stops a later screen from
 * quietly disagreeing with this one.
 */

const isClinical = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR;

/**
 * Reaching the chart at all. It shows procedures and chart marks, which
 * ROLES.md gives to admin and doctor; a technician's read is limited to
 * lab-linked rows, which the chart cannot express, and a receptionist has none.
 */
export const canViewChart = isClinical;

/** Recording a procedure: admin CRUD, doctor CRU. */
export const canRecordProcedure = isClinical;

/**
 * Prices and discounts. ROLES.md billing: admin and doctor read charges; a
 * technician gets no financial patient data at all. The chart route is already
 * limited to the first two, so this only ever hides prices today — it is here
 * so the rule survives the route opening up.
 */
export const canSeePrices = isClinical;

/**
 * X-rays and documents. ROLES.md is explicit that a receptionist response never
 * carries an attachment key or URL, and the API enforces it.
 *
 * A technician's read is limited to lab-linked attachments; nothing is
 * lab-linked until the labs module exists, so they are kept out of the imaging
 * tab entirely rather than shown an empty grid they cannot act on.
 */
export const canSeeAttachments = isClinical;

/** Uploading and removing images: the same roles that may write the record. */
export const canManageAttachments = isClinical;

/**
 * Only an admin deletes. ROLES.md global rule 5: nothing is hard-deleted, and
 * only an admin may soft-delete a medical or financial record.
 */
export const canDelete = (role: UserRole): boolean => role === USER_ROLE.ADMIN;

/**
 * The patients list itself. Every role reads it — a receptionist registers
 * patients, a technician looks one up — but the columns differ: the API hands
 * the last two `PatientPublicView`, so the table only ever renders what it was
 * given.
 */
export const canCreatePatient = (role: UserRole): boolean => role !== USER_ROLE.TECHNICIAN;

/**
 * Whether this caller receives the clinical view of a patient. Drives which
 * columns the list can show, so the table never advertises a field the
 * response does not carry.
 */
export const seesClinicalPatientFields = isClinical;
