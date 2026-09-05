import { USER_ROLE, type UserRole } from '@clinic/shared';

/**
 * The ROLES.md billing row.
 *
 * Hiding a control is cosmetic — the API refuses the request either way — but
 * keeping the rules beside the spec they come from is what makes them
 * reviewable.
 */

/**
 * Balances and statements: admin, doctor and receptionist read them. A
 * technician never sees financial patient data, so the API does not even put a
 * balance in their patient response.
 */
export const canSeeBilling = (role: UserRole): boolean => role !== USER_ROLE.TECHNICIAN;

/** Taking money: admin CRUD, receptionist CR. A doctor reads only. */
export const canRecordPayment = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.RECEPTIONIST;

/**
 * Reversing one. Admin only, and it is the only correction there is: nobody
 * updates or deletes a payment (CLAUDE.md ledger rules).
 */
export const canReversePayment = (role: UserRole): boolean => role === USER_ROLE.ADMIN;

/** The overdue screen: admin and receptionist (ROLES.md billing matrix). */
export const canSeeOverdue = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.RECEPTIONIST;
