import type { BadgeTone } from "@clinic/ui/components/badge";
import { WAITING_LIST_PRIORITY } from "@clinic/shared";

export const CALENDAR_RANGES = ["day", "week"] as const;

export const WEEK_FREE_GAP_MINUTES = 30;

export const APPOINTMENTS_VIEW_ALL = "all";

export const APPOINTMENTS_VIEW_PENDING = "pending";

export const APPOINTMENTS_VIEW_CONFIRMED = "confirmed";

export const APPOINTMENTS_VIEW_OVERDUE = "overdue";

export const WAITING_LIST_PRIORITY_TONES: Record<string, BadgeTone> = {
  [WAITING_LIST_PRIORITY.URGENT]: "danger",
  [WAITING_LIST_PRIORITY.HIGH]: "warning",
  [WAITING_LIST_PRIORITY.NORMAL]: "neutral",
};
