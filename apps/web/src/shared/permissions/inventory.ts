import { MOVEMENT_TYPE, type MovementType } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

export const seesInventory = (can: Can): boolean => can("inventory.list");

export const canManageInventory = (can: Can): boolean => can("inventory.create");

export const canDeleteItem = (can: Can): boolean => can("inventory.remove");

export const canDeleteSupplier = (can: Can): boolean => can("suppliers.remove");

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
