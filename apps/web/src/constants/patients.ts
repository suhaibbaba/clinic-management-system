import type { TimelineEntryType } from "@clinic/shared";
import type { IconName } from "@clinic/ui";
import { TIMELINE_ENTRY_TYPE, TIMELINE_ENTRY_TYPES, TREATMENT_PLAN_STATUSES } from "@clinic/shared";

export const PERMANENT_DENTITION_AGE = 13;

export const PATIENT_TABS = [
  { id: "chart", label: "patients.tabs.chart", clinical: true },
  { id: "visits", label: "patients.tabs.visits", clinical: true },
  { id: "treatmentPlans", label: "patients.tabs.treatmentPlans", clinical: true },
  { id: "attachments", label: "patients.tabs.attachments", clinical: true },
  { id: "prescriptions", label: "patients.tabs.prescriptions", clinical: true },
  { id: "timeline", label: "patients.tabs.timeline", clinical: true },
  { id: "billing", label: "patients.tabs.billing", clinical: false },
] as const;

export const PATIENT_TAB_PARAMS = ["page", "perPage", "type", "plan"] as const;

export const PATIENTS_BALANCE_FILTER = "balance";

export const PATIENTS_VISITED_FILTER = "visited";

export const TIMELINE_ENTRY_ICONS: Record<TimelineEntryType, IconName> = {
  [TIMELINE_ENTRY_TYPE.VISIT]: "stethoscope",
  [TIMELINE_ENTRY_TYPE.PROCEDURE]: "tooth",
  [TIMELINE_ENTRY_TYPE.ATTACHMENT]: "image",
  [TIMELINE_ENTRY_TYPE.PRESCRIPTION]: "file",
  [TIMELINE_ENTRY_TYPE.TREATMENT_PLAN]: "clipboard",
  [TIMELINE_ENTRY_TYPE.LAB_ORDER]: "coins",
  [TIMELINE_ENTRY_TYPE.SUPPLY]: "clipboard",
  [TIMELINE_ENTRY_TYPE.APPOINTMENT]: "calendar",
  [TIMELINE_ENTRY_TYPE.PAYMENT]: "money",
  [TIMELINE_ENTRY_TYPE.CHARGE]: "money",
};

export const TIMELINE_TYPE_FILTERS = ["all", ...TIMELINE_ENTRY_TYPES] as const;

export const TREATMENT_PLAN_FILTERS = ["all", ...TREATMENT_PLAN_STATUSES] as const;

export const PLAN_FULL_LIST_UP_TO = 4;

export const PLAN_PREVIEW_ITEMS = 3;

export const VISIT_PROCEDURE_FORM_ID = "visit-procedure-form";

export const SELECTABLE_SURFACES = ["B", "M", "O", "D", "L"] as const;

export const SURFACE_BOX = 120;

export const SURFACE_INSET = 34;

export const TREATMENT_PLAN_FORM_ID = "treatment-plan-form";

export const TREATMENT_PLAN_ITEM_FORM_ID = "treatment-plan-item-form";

export const PLAN_DOCTOR_VALUE = "";
