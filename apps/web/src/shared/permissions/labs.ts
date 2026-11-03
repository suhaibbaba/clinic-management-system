import { RULE } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

export const canManageLabs = (can: Can): boolean => can("labs.create");

export const canCreateLabOrder = (can: Can): boolean => can("lab-orders.create");

export const canPriceLabWork = (can: Can): boolean => can(RULE.LAB_PRICE);

export const canPayLab = (can: Can): boolean => can("lab-payments.create");

export const canSeeLabOrders = (can: Can): boolean => can("lab-orders.list");

export const canSeeLabCost = (can: Can): boolean => canSeeLabOrders(can) && canPriceLabWork(can);

export const canEditLabOrder = (can: Can): boolean => can("lab-orders.update");

export const canDeleteLabOrder = (can: Can): boolean => can("lab-orders.remove");

export const canOpenLabOrders = (can: Can): boolean => can("labs.list");
