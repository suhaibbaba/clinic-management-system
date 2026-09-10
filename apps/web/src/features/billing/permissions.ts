import { USER_ROLE, type UserRole } from '@clinic/shared';

// The ROLES.md billing row, kept beside the spec it comes from. Hiding a control is cosmetic — the
// API refuses either way.

// A technician never sees financial patient data, so the API does not put a balance in their
// patient response at all.
export const canSeeBilling = (role: UserRole): boolean => role !== USER_ROLE.TECHNICIAN;

/** Taking money: admin CRUD, receptionist CR. A doctor reads only. */
export const canRecordPayment = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.RECEPTIONIST;

/** Admin only, and the only correction there is: nobody updates or deletes a payment. */
export const canReversePayment = (role: UserRole): boolean => role === USER_ROLE.ADMIN;

export const canSeeOverdue = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.RECEPTIONIST;
