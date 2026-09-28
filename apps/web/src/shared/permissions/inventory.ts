import { MOVEMENT_TYPE, USER_ROLE, type MovementType, type UserRole } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

export const seesInventory = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.TECHNICIAN;

export const canManageInventory = (can: Can): boolean => can("inventory.create");

export const canManageSuppliers = (can: Can): boolean => can("suppliers.create");

export const canConsumeStock = (can: Can): boolean => can("inventory.consume");

export const canPurchaseStock = (can: Can): boolean => can("inventory.purchase");
export const canAdjustStock = (can: Can): boolean => can("inventory.adjust");

export const canReverseMovement = (can: Can): boolean => can("inventory.reverse");

export const mayRecord = (type: MovementType, can: Can): boolean =>
  ({
    [MOVEMENT_TYPE.PURCHASE]: canPurchaseStock,
    [MOVEMENT_TYPE.CONSUME]: canConsumeStock,
    [MOVEMENT_TYPE.ADJUST]: canAdjustStock,
  })[type](can);
