import { USER_ROLE, type UserRole } from '@clinic/shared';

/**
 * The labs matrix from ROLES.md, as three questions the screens ask.
 *
 * Every one of these is cosmetic — the API enforces the same rules and is the
 * real boundary. What they buy is a screen that does not offer a button whose
 * only outcome is a 403.
 */

/** "Labs directory & prices": admin CRUD, technician CRU. */
export const canManageLabs = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.TECHNICIAN;

/** "Lab orders": a doctor raises them; admin may too. */
export const canCreateLabOrder = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR;

/** "Lab payments": technician and admin create; only admin reverses. */
export const canPayLab = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.TECHNICIAN;

export const canReverseLabPayment = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN;
