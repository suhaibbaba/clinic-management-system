import { RULE } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

export const canSeeBilling = (can: Can): boolean => can(RULE.PATIENTS_FINANCIAL);

export const canDeletePayment = (can: Can): boolean => can("payments.remove");

export const canRecordPayment = (can: Can): boolean => can("payments.create");

export const canReversePayment = (can: Can): boolean => can("payments.reverse");
