import {
  type TimelineEntryType,
  type UserRole,
  USER_ROLE,
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

export function allowedTypes(role: UserRole): TimelineEntryType[] {
  switch (role) {
    case USER_ROLE.ADMIN:
    case USER_ROLE.DOCTOR:
      return [
        TIMELINE_ENTRY_TYPE.VISIT,
        TIMELINE_ENTRY_TYPE.PROCEDURE,
        TIMELINE_ENTRY_TYPE.ATTACHMENT,
        TIMELINE_ENTRY_TYPE.PRESCRIPTION,
        TIMELINE_ENTRY_TYPE.TREATMENT_PLAN,
        TIMELINE_ENTRY_TYPE.APPOINTMENT,
        TIMELINE_ENTRY_TYPE.PAYMENT,
        TIMELINE_ENTRY_TYPE.CHARGE,
        TIMELINE_ENTRY_TYPE.LAB_ORDER,
        TIMELINE_ENTRY_TYPE.SUPPLY,
      ];
    case USER_ROLE.VISITING_DOCTOR:
      return [
        TIMELINE_ENTRY_TYPE.VISIT,
        TIMELINE_ENTRY_TYPE.PROCEDURE,
        TIMELINE_ENTRY_TYPE.ATTACHMENT,
        TIMELINE_ENTRY_TYPE.PRESCRIPTION,
        TIMELINE_ENTRY_TYPE.TREATMENT_PLAN,
        TIMELINE_ENTRY_TYPE.APPOINTMENT,
      ];
    case USER_ROLE.RECEPTIONIST:
      return [
        TIMELINE_ENTRY_TYPE.APPOINTMENT,
        TIMELINE_ENTRY_TYPE.PAYMENT,
        TIMELINE_ENTRY_TYPE.CHARGE,
      ];
    default:
      return [];
  }
}

export function toTimelineEntry(row: TimelineRow): TimelineEntry {
  return {
    id: row.id,
    type: row.type,
    occurredAt: new Date(row.occurred_at).toISOString(),
    title: row.title,
    detail: row.detail,
  };
}
