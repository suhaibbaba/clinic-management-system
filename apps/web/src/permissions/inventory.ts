import { USER_ROLE, type UserRole } from "@clinic/shared";
import type { Can } from "@web/providers/session";

export const seesInventory = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.TECHNICIAN;

export const canManageInventory = (can: Can): boolean => can("inventory.create");

export const canManageSuppliers = (can: Can): boolean => can("suppliers.create");

export const canConsumeStock = (can: Can): boolean => can("inventory.consume");

export const canPurchaseStock = (can: Can): boolean => can("inventory.purchase");
export const canAdjustStock = (can: Can): boolean => can("inventory.adjust");

export const canReverseMovement = (can: Can): boolean => can("inventory.reverse");
