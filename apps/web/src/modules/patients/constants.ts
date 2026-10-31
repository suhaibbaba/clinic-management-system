import {
  type TimelineEntryType,
  TIMELINE_ENTRY_TYPE,
  TIMELINE_ENTRY_TYPES,
  PERFORMED_PROCEDURE_STATUSES,
} from "@clinic/shared";
import type { IconName } from "@clinic/ui";

export const PERMANENT_DENTITION_AGE = 13;

export const PATIENT_TABS = [
  { id: "chart", label: "patients.tabs.chart", clinical: true, reads: "procedures.list" },
  { id: "visits", label: "patients.tabs.visits", clinical: true, reads: "visits.list" },
  {
    id: "treatmentPlans",
    label: "patients.tabs.treatmentPlan",
    clinical: true,
    reads: "procedures.list",
  },
  {
    id: "attachments",
    label: "patients.tabs.attachments",
    clinical: true,
    reads: "patient-attachments.list",
  },
  {
    id: "prescriptions",
    label: "patients.tabs.prescriptions",
    clinical: true,
    reads: "prescriptions.list",
  },
  { id: "timeline", label: "patients.tabs.timeline", clinical: true, reads: "timeline.list" },
  { id: "billing", label: "patients.tabs.billing", clinical: false },
] as const;

export const PATIENT_TAB_PARAMS = ["page", "perPage", "type", "status", "chart"] as const;

export const PATIENTS_BALANCE_FILTER = "balance";

export const PATIENTS_VISITED_FILTER = "visited";

export const TIMELINE_ENTRY_ICONS: Record<TimelineEntryType, IconName> = {
  [TIMELINE_ENTRY_TYPE.VISIT]: "stethoscope",
  [TIMELINE_ENTRY_TYPE.PROCEDURE]: "tooth",
  [TIMELINE_ENTRY_TYPE.ATTACHMENT]: "image",
  [TIMELINE_ENTRY_TYPE.PRESCRIPTION]: "file",
  [TIMELINE_ENTRY_TYPE.LAB_ORDER]: "coins",
  [TIMELINE_ENTRY_TYPE.SUPPLY]: "clipboard",
  [TIMELINE_ENTRY_TYPE.APPOINTMENT]: "calendar",
  [TIMELINE_ENTRY_TYPE.PAYMENT]: "money",
  [TIMELINE_ENTRY_TYPE.CHARGE]: "money",
};

export const TIMELINE_TYPE_FILTERS = ["all", ...TIMELINE_ENTRY_TYPES] as const;

export const TREATMENT_FILTERS = ["all", ...PERFORMED_PROCEDURE_STATUSES] as const;

export const SELECTABLE_SURFACES = ["B", "M", "O", "D", "L"] as const;

export const SURFACE_BOX = 120;

export const SURFACE_INSET = 34;

export const TREATMENT_FORM_ID = "treatment-form";

export const SKELETON_URL = "/charts/skeleton.svg";
