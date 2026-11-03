import { RULE } from "@shared/constants/permissions";

export const DASHBOARD_WIDGET = {
  GREETING: "greeting",
  KEY_NUMBERS: "keyNumbers",
  SCHEDULE: "schedule",
  CALENDAR: "calendar",
  NOTES: "notes",
  QUICK_ACTIONS: "quickActions",
  VISITS_TODAY: "visitsToday",
  TOP_DEBTS: "topDebts",
  NEW_PATIENTS: "newPatients",
  COLLECTIONS: "collections",
} as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET)[keyof typeof DASHBOARD_WIDGET];

export const DASHBOARD_WIDGET_IDS = Object.values(DASHBOARD_WIDGET) as [
  DashboardWidgetId,
  ...DashboardWidgetId[],
];

export const DASHBOARD_ZONE = {
  TOP: "top",
  MAIN: "main",
  SIDE: "side",
} as const;

export type DashboardZone = (typeof DASHBOARD_ZONE)[keyof typeof DASHBOARD_ZONE];

export const DASHBOARD_ZONES = Object.values(DASHBOARD_ZONE) as [DashboardZone, ...DashboardZone[]];

export const DASHBOARD_WIDTH = {
  THIRD: "third",
  HALF: "half",
  TWO_THIRDS: "twoThirds",
  FULL: "full",
} as const;

export type DashboardWidth = (typeof DASHBOARD_WIDTH)[keyof typeof DASHBOARD_WIDTH];

export const DASHBOARD_WIDTHS = Object.values(DASHBOARD_WIDTH) as [
  DashboardWidth,
  ...DashboardWidth[],
];

export const DASHBOARD_GRID_COLUMNS = 6;

export const DASHBOARD_WIDTH_COLUMNS: Readonly<Record<DashboardWidth, number>> = {
  [DASHBOARD_WIDTH.THIRD]: 2,
  [DASHBOARD_WIDTH.HALF]: 3,
  [DASHBOARD_WIDTH.TWO_THIRDS]: 4,
  [DASHBOARD_WIDTH.FULL]: 6,
};

export const DASHBOARD_KEY_NUMBER = {
  APPOINTMENTS_TODAY: "appointmentsToday",
  PENDING_BOOKINGS: "pendingBookings",
  OVERDUE: "overdue",
  VISITS_TODAY: "visitsToday",
  COLLECTED_TODAY: "collectedToday",
  NEW_PATIENTS_TODAY: "newPatientsToday",
} as const;

export type DashboardKeyNumber = (typeof DASHBOARD_KEY_NUMBER)[keyof typeof DASHBOARD_KEY_NUMBER];

export const DASHBOARD_KEY_NUMBERS = Object.values(DASHBOARD_KEY_NUMBER) as [
  DashboardKeyNumber,
  ...DashboardKeyNumber[],
];

export const DASHBOARD_QUICK_ACTION = {
  PATIENT: "patient",
  APPOINTMENT: "appointment",
  VISIT: "visit",
  PAYMENT: "payment",
} as const;

export type DashboardQuickAction =
  (typeof DASHBOARD_QUICK_ACTION)[keyof typeof DASHBOARD_QUICK_ACTION];

export const DASHBOARD_QUICK_ACTIONS = Object.values(DASHBOARD_QUICK_ACTION) as [
  DashboardQuickAction,
  ...DashboardQuickAction[],
];

export const DASHBOARD_CAPABILITY = {
  VISITS_TODAY: "dashboard.visitsToday",
  COLLECTIONS: "dashboard.collections",
  OVERDUE_LIST: "billing.list",
  PATIENTS_LIST: "patients.list",
  CREATE_PATIENT: "patients.create",
  CREATE_VISIT: "visits.create",
  CREATE_PAYMENT: "payments.create",
  CREATE_APPOINTMENT: "appointments.create",
} as const;

export interface DashboardWidgetDefinition {
  readonly requires: readonly string[];
  readonly requiresAny?: readonly string[];
  readonly zones: readonly DashboardZone[];
}

export const DASHBOARD_WIDGETS: Readonly<Record<DashboardWidgetId, DashboardWidgetDefinition>> = {
  [DASHBOARD_WIDGET.GREETING]: {
    requires: [],
    zones: [DASHBOARD_ZONE.TOP, DASHBOARD_ZONE.MAIN],
  },
  [DASHBOARD_WIDGET.KEY_NUMBERS]: {
    requires: [],
    zones: [DASHBOARD_ZONE.MAIN, DASHBOARD_ZONE.TOP],
  },
  [DASHBOARD_WIDGET.SCHEDULE]: {
    requires: ["appointments.list"],
    zones: [DASHBOARD_ZONE.MAIN, DASHBOARD_ZONE.TOP],
  },
  [DASHBOARD_WIDGET.CALENDAR]: {
    requires: ["appointments.list"],
    zones: [DASHBOARD_ZONE.SIDE, DASHBOARD_ZONE.MAIN],
  },
  [DASHBOARD_WIDGET.NOTES]: {
    requires: ["notes.list"],
    zones: [DASHBOARD_ZONE.SIDE, DASHBOARD_ZONE.MAIN],
  },
  [DASHBOARD_WIDGET.QUICK_ACTIONS]: {
    requires: [],
    requiresAny: [
      DASHBOARD_CAPABILITY.CREATE_PATIENT,
      DASHBOARD_CAPABILITY.CREATE_APPOINTMENT,
      DASHBOARD_CAPABILITY.CREATE_VISIT,
      DASHBOARD_CAPABILITY.CREATE_PAYMENT,
    ],
    zones: [DASHBOARD_ZONE.SIDE, DASHBOARD_ZONE.MAIN, DASHBOARD_ZONE.TOP],
  },
  [DASHBOARD_WIDGET.VISITS_TODAY]: {
    requires: [DASHBOARD_CAPABILITY.VISITS_TODAY],
    zones: [DASHBOARD_ZONE.MAIN, DASHBOARD_ZONE.TOP],
  },
  [DASHBOARD_WIDGET.TOP_DEBTS]: {
    requires: [DASHBOARD_CAPABILITY.OVERDUE_LIST],
    zones: [DASHBOARD_ZONE.SIDE, DASHBOARD_ZONE.MAIN],
  },
  [DASHBOARD_WIDGET.NEW_PATIENTS]: {
    requires: [DASHBOARD_CAPABILITY.PATIENTS_LIST],
    zones: [DASHBOARD_ZONE.SIDE, DASHBOARD_ZONE.MAIN],
  },
  [DASHBOARD_WIDGET.COLLECTIONS]: {
    requires: [DASHBOARD_CAPABILITY.COLLECTIONS],
    zones: [DASHBOARD_ZONE.MAIN, DASHBOARD_ZONE.SIDE],
  },
};

export const DASHBOARD_KEY_NUMBER_REQUIRES: Readonly<
  Record<DashboardKeyNumber, readonly string[]>
> = {
  [DASHBOARD_KEY_NUMBER.APPOINTMENTS_TODAY]: ["appointments.list"],
  [DASHBOARD_KEY_NUMBER.PENDING_BOOKINGS]: ["pending-bookings.list"],
  [DASHBOARD_KEY_NUMBER.OVERDUE]: [RULE.OVERDUE_WIDGET],
  [DASHBOARD_KEY_NUMBER.VISITS_TODAY]: [DASHBOARD_CAPABILITY.VISITS_TODAY],
  [DASHBOARD_KEY_NUMBER.COLLECTED_TODAY]: [DASHBOARD_CAPABILITY.COLLECTIONS],
  [DASHBOARD_KEY_NUMBER.NEW_PATIENTS_TODAY]: [DASHBOARD_CAPABILITY.PATIENTS_LIST],
};

export const DASHBOARD_QUICK_ACTION_REQUIRES: Readonly<Record<DashboardQuickAction, string>> = {
  [DASHBOARD_QUICK_ACTION.PATIENT]: DASHBOARD_CAPABILITY.CREATE_PATIENT,
  [DASHBOARD_QUICK_ACTION.APPOINTMENT]: DASHBOARD_CAPABILITY.CREATE_APPOINTMENT,
  [DASHBOARD_QUICK_ACTION.VISIT]: DASHBOARD_CAPABILITY.CREATE_VISIT,
  [DASHBOARD_QUICK_ACTION.PAYMENT]: DASHBOARD_CAPABILITY.CREATE_PAYMENT,
};

export const DASHBOARD_CAPABILITIES: readonly string[] = [
  ...new Set([
    ...Object.values(DASHBOARD_WIDGETS).flatMap((widget) => [
      ...widget.requires,
      ...(widget.requiresAny ?? []),
    ]),
    ...Object.values(DASHBOARD_KEY_NUMBER_REQUIRES).flat(),
  ]),
];

export const DASHBOARD_CUSTOMIZE_PARAM = "customize";

export const DASHBOARD_LIST_LIMIT = 5;

export const DASHBOARD_VISITS_LIMIT = 20;

export const DASHBOARD_COLLECTION_DAYS = 7;
