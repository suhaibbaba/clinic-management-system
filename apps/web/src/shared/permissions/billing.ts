import { USER_ROLE, type UserRole } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

export const canSeeBilling = (role: UserRole): boolean =>
  role !== USER_ROLE.TECHNICIAN && role !== USER_ROLE.VISITING_DOCTOR;

export const canRecordPayment = (can: Can): boolean => can("payments.create");

export const canReversePayment = (can: Can): boolean => can("payments.reverse");
