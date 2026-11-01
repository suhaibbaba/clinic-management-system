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
  INVENTORY_COSTS: "inventory.costs",
  REVERSE_PRICED_PURCHASE: "inventory.reversePricedPurchase",
  BACKDATE_PURCHASES: "purchasing.backdate",
} as const;

export type Rule = (typeof RULE)[keyof typeof RULE];

export const CLINIC_MODULE = {
  APPOINTMENTS: "appointments",
  BOOKING: "booking",
  LABS: "labs",
  INVENTORY: "inventory",
  EXPENSES: "expenses",
  PAYROLL: "payroll",
  ASSISTANT: "assistant",
  WEBSITE: "website",
} as const;

export const CLINIC_MODULES = Object.values(CLINIC_MODULE);

export type ClinicModule = (typeof CLINIC_MODULE)[keyof typeof CLINIC_MODULE];

export const STANDARD_CLINIC_MODULES: readonly ClinicModule[] = [
  CLINIC_MODULE.APPOINTMENTS,
  CLINIC_MODULE.BOOKING,
  CLINIC_MODULE.LABS,
  CLINIC_MODULE.INVENTORY,
  CLINIC_MODULE.EXPENSES,
  CLINIC_MODULE.PAYROLL,
];

export const MODULE_REQUIRES: Readonly<Partial<Record<ClinicModule, readonly ClinicModule[]>>> = {
  [CLINIC_MODULE.BOOKING]: [CLINIC_MODULE.APPOINTMENTS],
};

export const missingModules = (modules: readonly string[]): ClinicModule[] => {
  const enabled = new Set(modules);

  return [
    ...new Set(
      modules.flatMap((module) =>
        (MODULE_REQUIRES[module as ClinicModule] ?? []).filter((needed) => !enabled.has(needed)),
      ),
    ),
  ];
};
