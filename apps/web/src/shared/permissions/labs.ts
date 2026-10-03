import { RULE } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

export const canManageLabs = (can: Can): boolean => can("labs.create");

export const canCreateLabOrder = (can: Can): boolean => can("lab-orders.create");

export const canPriceLabWork = (can: Can): boolean => can(RULE.LAB_PRICE);

export const canPayLab = (can: Can): boolean => can("lab-payments.create");
