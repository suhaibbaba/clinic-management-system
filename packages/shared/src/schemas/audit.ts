import { z } from 'zod';

import { AUDIT_ACTIONS } from '@shared/enums';
import { paginationQuerySchema } from '@shared/schemas/common';

/**
 * One immutable audit entry. There is no update or delete endpoint for this
 * resource anywhere in the API (CLAUDE.md architecture decision 4).
 */
export const auditLogEntrySchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  /** Null for actions performed by the system rather than a signed-in user. */
  userId: z.uuid().nullable(),
  action: z.enum(AUDIT_ACTIONS),
  /** Table name of the affected row, e.g. `users`. */
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
  /** Inclusive lower bound on `createdAt`. */
  from: z.iso.datetime().optional(),
  /** Exclusive upper bound on `createdAt`. */
  to: z.iso.datetime().optional(),
});
export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;
