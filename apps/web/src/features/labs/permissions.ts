import type { Can } from "@web/features/auth/session";

// What the clinic lets this reader do, not what the role shipped with — the admin moves these on
// the permissions screen. Hiding a control is cosmetic; the API refuses either way.

/** "Labs directory & prices". */
export const canManageLabs = (can: Can): boolean => can("labs.create");

/** "Lab orders": raising one. */
export const canCreateLabOrder = (can: Can): boolean => can("lab-orders.create");

/** "Lab payments": paying a lab. */
export const canPayLab = (can: Can): boolean => can("lab-payments.create");
