import type { Can } from "@web/shared/providers/session";

export const canManageLabs = (can: Can): boolean => can("labs.create");

export const canCreateLabOrder = (can: Can): boolean => can("lab-orders.create");

export const canPayLab = (can: Can): boolean => can("lab-payments.create");
