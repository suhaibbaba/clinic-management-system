import { z } from "zod";
import { AUDIT_ACTIONS } from "@shared/enums";
import { paginationQuerySchema } from "@shared/schemas/common";

export const auditLogEntrySchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  userId: z.uuid().nullable(),
  action: z.enum(AUDIT_ACTIONS),
  entity: z.string(),
  entityId: z.uuid(),
  oldValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const listAuditLogQuerySchema = paginationQuerySchema.extend({
  entity: z.string().trim().min(1).max(64).optional(),
  entityId: z.uuid().optional(),
  userId: z.uuid().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;
