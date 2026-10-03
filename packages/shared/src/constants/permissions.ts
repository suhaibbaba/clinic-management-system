export const RULE = {
  PATIENTS_CLINICAL: "patients.clinical",
  PATIENTS_FINANCIAL: "patients.financial",
  PATIENTS_ALL: "patients.all",
  CATALOG_DETAILS: "procedure-catalog.details",
  ALL_CALENDARS: "appointments.allCalendars",
  LAB_PRICE: "lab-orders.setPrice",
  ALL_SCHEDULES: "doctors.allSchedules",
  ALL_NOTES: "notes.manageAll",
  DELETED_PAYMENTS: "payments.viewDeleted",
  OVERDUE_WIDGET: "dashboard.overdue",
} as const;

export type Rule = (typeof RULE)[keyof typeof RULE];

export const CLINIC_MODULE = {
  ASSISTANT: "assistant",
} as const;

export const CLINIC_MODULES = Object.values(CLINIC_MODULE);

export type ClinicModule = (typeof CLINIC_MODULE)[keyof typeof CLINIC_MODULE];
