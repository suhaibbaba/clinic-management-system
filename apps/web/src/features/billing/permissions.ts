import { USER_ROLE, type UserRole } from "@clinic/shared";
import type { Can } from "@web/features/auth/session";

export const canSeeBilling = (role: UserRole): boolean => role !== USER_ROLE.TECHNICIAN;

/** Taking money. */
export const canRecordPayment = (can: Can): boolean => can("payments.create");

/** The only correction there is: nobody updates or deletes a payment. */
export const canReversePayment = (can: Can): boolean => can("payments.reverse");
