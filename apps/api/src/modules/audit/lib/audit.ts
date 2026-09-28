import { type AuditAction, type AuditLogEntry } from "@clinic/shared";
import { auditLog } from "@api/database/schema";

export interface RecordAuditEntry {
  readonly clinicId: string;
  readonly userId: string | null;
  readonly action: AuditAction;
  readonly entity: string;
  readonly entityId: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

export function toAuditLogEntry(row: typeof auditLog.$inferSelect): AuditLogEntry {
  return {
    id: row.id,
    clinicId: row.clinicId,
    userId: row.userId,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    oldValue: row.oldValue ?? null,
    newValue: row.newValue ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
