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
 */
export const canSeeAttachments = isClinical;
