import { AI_TOOL, type AiToolName } from "@clinic/shared";

/** What each group is for, in one line: the prompt lists these before anything is loaded. */
export const TOOL_GROUPS = {
  appointments: "booking, moving, cancelling and confirming appointments; free times",
  patients: "registering patients and adding notes to their file",
  schedule: "doctors' time off, extra hours and weekly hours; clinic closures",
  labs: "lab orders and their steps, labs, what the clinic pays them",
  inventory: "stock items, purchases, uses, counts and their reversal",
  billing: "patient payments and their reversal",
  reports: "daily counts and the financial summary",
} as const;

export type ToolGroup = keyof typeof TOOL_GROUPS;

export const TOOL_GROUP_NAMES = Object.keys(TOOL_GROUPS) as [ToolGroup, ...ToolGroup[]];

/** Sent on every request; everything else waits for `load_tools`. */
export const CORE = "core";

// One entry per tool, so a new tool is a type error here until it is placed.
export const TOOL_GROUP: Record<AiToolName, ToolGroup | typeof CORE> = {
  [AI_TOOL.SEARCH_PATIENTS]: CORE,
  [AI_TOOL.GET_APPOINTMENTS]: CORE,
  [AI_TOOL.FIND_DOCTORS]: CORE,
  [AI_TOOL.GET_PATIENT_SUMMARY]: CORE,
  [AI_TOOL.QUERY_DATA]: CORE,
  [AI_TOOL.DRAFT_BULK_MESSAGE]: CORE,
  [AI_TOOL.PROPOSE_PLAN]: CORE,
  [AI_TOOL.LOAD_TOOLS]: CORE,

  [AI_TOOL.SET_APPOINTMENT_STATUS]: "appointments",
  [AI_TOOL.CREATE_APPOINTMENT]: "appointments",
  [AI_TOOL.RESCHEDULE_APPOINTMENT]: "appointments",
  [AI_TOOL.CANCEL_APPOINTMENTS]: "appointments",
  [AI_TOOL.FIND_AVAILABLE_SLOTS]: "appointments",

  [AI_TOOL.ADD_PATIENT_NOTE]: "patients",
  [AI_TOOL.CREATE_PATIENT]: "patients",

  [AI_TOOL.ADD_DOCTOR_TIME_OFF]: "schedule",
  [AI_TOOL.ADD_CLINIC_CLOSURE]: "schedule",
  [AI_TOOL.GET_DOCTOR_TIME_OFF]: "schedule",
  [AI_TOOL.UPDATE_DOCTOR_TIME_OFF]: "schedule",
  [AI_TOOL.DELETE_DOCTOR_TIME_OFF]: "schedule",
  [AI_TOOL.SET_DOCTOR_SCHEDULE]: "schedule",
  [AI_TOOL.ADD_DOCTOR_EXTRA_HOURS]: "schedule",

  [AI_TOOL.GET_OVERDUE_LAB_ORDERS]: "labs",
  [AI_TOOL.FIND_LAB_ORDERS]: "labs",
  [AI_TOOL.SET_LAB_ORDER_STATUS]: "labs",
  [AI_TOOL.FIND_LABS]: "labs",
  [AI_TOOL.GET_LAB_PAYMENTS]: "labs",
  [AI_TOOL.RECORD_LAB_PAYMENT]: "labs",
  [AI_TOOL.REVERSE_LAB_PAYMENT]: "labs",

  [AI_TOOL.GET_LOW_STOCK_ITEMS]: "inventory",
  [AI_TOOL.FIND_STOCK_ITEMS]: "inventory",
  [AI_TOOL.RECORD_STOCK_MOVEMENT]: "inventory",
  [AI_TOOL.GET_STOCK_MOVEMENTS]: "inventory",
  [AI_TOOL.REVERSE_STOCK_MOVEMENT]: "inventory",

  [AI_TOOL.RECORD_PAYMENT]: "billing",
  [AI_TOOL.FIND_PAYMENTS]: "billing",
  [AI_TOOL.REVERSE_PAYMENT]: "billing",

  [AI_TOOL.GET_DAILY_STATS]: "reports",
  [AI_TOOL.GET_FINANCIAL_SUMMARY]: "reports",
};

/** The groups' one-liners, stable for the prompt cache. */
export function groupCatalogue(): string {
  return TOOL_GROUP_NAMES.map((group) => `${group} — ${TOOL_GROUPS[group]}`).join("\n");
}

export const isVisible = (tool: { group: string }, loaded: ReadonlySet<string>): boolean =>
  tool.group === CORE || loaded.has(tool.group);
