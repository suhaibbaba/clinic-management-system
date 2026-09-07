import { USER_ROLE, type UserRole } from '@clinic/shared';

/**
 * The inventory matrix from ROLES.md, as the four questions the screens ask.
 *
 * Every one of these is cosmetic — the API enforces the same rules and is the
 * real boundary. What they buy is a screen that never offers a button whose
 * only outcome is a 403.
 */

/** Who sees the module at all. A receptionist is in none of its rows. */
export const seesInventory = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.TECHNICIAN;

/** "Items & suppliers": admin CRUD, technician CRU, doctor read. */
export const canManageInventory = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.TECHNICIAN;

/**
 * "Stock movements: consume" — the one write a doctor makes here. They use an
 * ampoule at the chair and say so, which is the only way the count ever
 * matches the cupboard.
 */
export const canConsumeStock = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.TECHNICIAN;

/** Purchases and stock takes are the technician's, with the admin over them. */
export const canPurchaseStock = canManageInventory;
export const canAdjustStock = canManageInventory;

/** Only an admin may write the entry that undoes another. */
export const canReverseMovement = (role: UserRole | undefined): boolean => role === USER_ROLE.ADMIN;
