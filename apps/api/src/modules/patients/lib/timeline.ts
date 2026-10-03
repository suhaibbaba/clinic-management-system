import {
  type TimelineEntryType,
  RULE,
  TIMELINE_ENTRY_TYPE,
  type TimelineEntry,
} from "@clinic/shared";

export interface TimelineRow extends Record<string, unknown> {
  readonly id: string;
  readonly type: TimelineEntryType;
  readonly occurred_at: Date;
  readonly title: string;
  readonly detail: Record<string, unknown>;
}

export const TIMELINE_TYPE_CAPABILITY: Readonly<Record<TimelineEntryType, string>> = {
  [TIMELINE_ENTRY_TYPE.VISIT]: RULE.PATIENTS_CLINICAL,
  [TIMELINE_ENTRY_TYPE.PROCEDURE]: RULE.PATIENTS_CLINICAL,
  [TIMELINE_ENTRY_TYPE.ATTACHMENT]: RULE.PATIENTS_CLINICAL,
  [TIMELINE_ENTRY_TYPE.PRESCRIPTION]: RULE.PATIENTS_CLINICAL,
  [TIMELINE_ENTRY_TYPE.APPOINTMENT]: "appointments.list",
  [TIMELINE_ENTRY_TYPE.PAYMENT]: RULE.PATIENTS_FINANCIAL,
  [TIMELINE_ENTRY_TYPE.CHARGE]: RULE.PATIENTS_FINANCIAL,
  [TIMELINE_ENTRY_TYPE.LAB_ORDER]: "lab-orders.list",
  [TIMELINE_ENTRY_TYPE.SUPPLY]: "inventory.list",
};

export function toTimelineEntry(row: TimelineRow): TimelineEntry {
  return {
    id: row.id,
    type: row.type,
    occurredAt: new Date(row.occurred_at).toISOString(),
    title: row.title,
    detail: row.detail,
  };
}
