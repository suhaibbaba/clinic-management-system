import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { AuditAction, AuditLogEntry, ListAuditLogQuery, Paginated } from '@clinic/shared';

import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { auditLog } from '@api/database/schema';

export interface RecordAuditEntry {
  readonly clinicId: string;
  readonly userId: string | null;
  readonly action: AuditAction;
  readonly entity: string;
  readonly entityId: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

/**
 * Writes and reads the immutable audit trail. There is deliberately no update
 * or delete method here, and no endpoint that could reach one.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Appends one entry. Failures propagate: a mutation whose audit row cannot be
   * written must not be reported as successful (CLAUDE.md "never skip the audit
   * interceptor on a financial/medical mutation").
   */
  async record(entry: RecordAuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      clinicId: entry.clinicId,
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
    });
  }

  /** Admin-only listing, always scoped to the caller's clinic. */
  async list(
    actor: AuthenticatedUser,
    query: ListAuditLogQuery,
  ): Promise<Paginated<AuditLogEntry>> {
    const conditions: SQL[] = [eq(auditLog.clinicId, actor.clinicId)];

    if (query.entity) {
      conditions.push(eq(auditLog.entity, query.entity));
    }
    if (query.entityId) {
      conditions.push(eq(auditLog.entityId, query.entityId));
    }
    if (query.userId) {
      conditions.push(eq(auditLog.userId, query.userId));
    }
    if (query.action) {
      conditions.push(eq(auditLog.action, query.action));
    }
    if (query.from) {
      conditions.push(gte(auditLog.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lt(auditLog.createdAt, new Date(query.to)));
    }

    const where = and(...conditions);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(auditLog).where(where),
    ]);

    return toPaginated(rows.map(toAuditLogEntry), totals?.value ?? 0, query);
  }
}

function toAuditLogEntry(row: typeof auditLog.$inferSelect): AuditLogEntry {
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
