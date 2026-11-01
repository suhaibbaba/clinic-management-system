import type { BadgeTone } from "@clinic/ui";
import type { PayStatus } from "@web/modules/payroll/lib/plans";
import type { PatientPaidFilter } from "@web/modules/payroll/lib/share-groups";

export const PAYOUT_MODES = ["treatments", "advance"] as const;

export const SETTLEMENT_ALL_TIME_FROM = "2000-01-01";

export const PERSON_TABS = ["statement", "settings"] as const;

export const PAY_STATUS_TONES: Record<PayStatus, BadgeTone> = {
  nothing: "neutral",
  paid: "success",
  partly: "warning",
  unpaid: "danger",
  owesClinic: "info",
};

export const FINANCE_TABS = ["payroll", "profit", "expenses"] as const;

export const PATIENT_PAID_FILTERS: readonly PatientPaidFilter[] = ["partly", "none"];
