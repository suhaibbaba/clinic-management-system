import { APPOINTMENT_STATUS } from "@clinic/shared";

export const DASHBOARD_ALL_DOCTORS = "all";

export const MINI_CALENDAR_WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export const SPENT_APPOINTMENT_STATUSES: readonly string[] = [
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.CANCELLED,
];
