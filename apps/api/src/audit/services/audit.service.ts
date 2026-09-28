import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { type AuditLogEntry, type ListAuditLogQuery, type Paginated } from "@clinic/shared";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { auditLog } from "@api/database/schema";
import { RecordAuditEntry, toAuditLogEntry } from "@api/audit/lib/audit";

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async record(entry: RecordAuditEntry, executor: DatabaseExecutor = this.db): Promise<void> {
    await executor.insert(auditLog).values({
      clinicId: entry.clinicId,
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
    });
  }

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
