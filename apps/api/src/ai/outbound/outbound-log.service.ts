import { Inject, Injectable } from "@nestjs/common";
import {
  AI_OUTBOUND_TRIGGER,
  NOTIFICATION_CHANNEL,
  type AiOutboundLogEntry,
  type ListAiOutboundQuery,
  type Paginated,
} from "@clinic/shared";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { OUTBOUND_AUDIT_TOOL } from "@api/ai/outbound/proposals.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { aiAuditLog, patients } from "@api/database/schema";

@Injectable()
export class OutboundLogService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(
    actor: AuthenticatedUser,
    query: ListAiOutboundQuery,
  ): Promise<Paginated<AiOutboundLogEntry>> {
    const where = and(
      eq(aiAuditLog.clinicId, actor.clinicId),
      eq(aiAuditLog.toolName, OUTBOUND_AUDIT_TOOL),
      query.trigger ? eq(aiAuditLog.trigger, query.trigger) : undefined,
      query.outcome ? eq(aiAuditLog.outcome, query.outcome) : undefined,
      query.proposalId ? eq(aiAuditLog.proposalId, query.proposalId) : undefined,
      query.from ? gte(aiAuditLog.createdAt, new Date(query.from)) : undefined,
      query.to ? lt(aiAuditLog.createdAt, new Date(query.to)) : undefined,
    );
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          id: aiAuditLog.id,
          proposalId: aiAuditLog.proposalId,
          trigger: aiAuditLog.trigger,
          channel: aiAuditLog.channel,
          patientId: aiAuditLog.patientId,
          patientName: patients.fullName,
          recipient: aiAuditLog.recipient,
          text: aiAuditLog.renderedText,
          userId: aiAuditLog.userId,
          outcome: aiAuditLog.outcome,
          createdAt: aiAuditLog.createdAt,
        })
        .from(aiAuditLog)
        .leftJoin(patients, eq(patients.id, aiAuditLog.patientId))
        .where(where)
        .orderBy(desc(aiAuditLog.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(aiAuditLog)
        .where(where),
    ]);

    return toPaginated(
      rows.map((row) => ({
        id: row.id,
        proposalId: row.proposalId,
        trigger: row.trigger ?? AI_OUTBOUND_TRIGGER.COMMAND,
        channel: row.channel ?? NOTIFICATION_CHANNEL.WHATSAPP,
        patientId: row.patientId,
        patientName: row.patientName,
        recipient: row.recipient ?? "",
        text: row.text ?? "",
        userId: row.userId,
        outcome: row.outcome,
        createdAt: row.createdAt.toISOString(),
      })),
      totals?.value ?? 0,
      query,
    );
  }
}
