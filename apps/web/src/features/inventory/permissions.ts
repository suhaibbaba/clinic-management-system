import { USER_ROLE, type UserRole } from '@clinic/shared';

import type { Can } from '@web/features/auth/session';

/** Who sees the module at all — a route, which is a role rather than a permission. */
export const seesInventory = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.TECHNICIAN;

/** Items: adding one, and editing one. */
export const canManageInventory = (can: Can): boolean => can('inventory.create');

/** Suppliers keep their own switch: a clinic can let somebody buy without letting them edit the
 *  book of who from. */
export const canManageSuppliers = (can: Can): boolean => can('suppliers.create');

export const canConsumeStock = (can: Can): boolean => can('inventory.consume');

export const canPurchaseStock = (can: Can): boolean => can('inventory.purchase');
export const canAdjustStock = (can: Can): boolean => can('inventory.adjust');

/** The entry that undoes another. */
export const canReverseMovement = (can: Can): boolean => can('inventory.reverse');
