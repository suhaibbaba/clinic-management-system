import { APPOINTMENT_STATUS } from "@clinic/shared";

export const DASHBOARD_ALL_DOCTORS = "all";

export const MINI_CALENDAR_WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export const SPENT_APPOINTMENT_STATUSES: readonly string[] = [
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.CANCELLED,
];

export const DASHBOARD_SPAN_CLASS: Readonly<Record<number, string>> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
};

export const DASHBOARD_KEY_NUMBER_LABEL: Readonly<Record<string, string>> = {
  appointmentsToday: "dashboard.kpi.today",
  pendingBookings: "dashboard.kpi.pending",
  overdue: "dashboard.kpi.overdue",
  visitsToday: "dashboard.kpi.visits",
  collectedToday: "dashboard.kpi.collected",
  newPatientsToday: "dashboard.kpi.newPatients",
};
