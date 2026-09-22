import { HttpStatus, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  addDays,
  AI_ACTION_ENTITIES,
  AI_ACTION_ERROR,
  AI_ACTION_ERRORS,
  AI_OUTBOUND_ERROR,
  AI_OUTBOUND_TARGET,
  AI_OUTBOUND_TARGETS,
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_KIND,
  AI_PROPOSAL_STATUS,
  AI_STREAM_EVENT,
  aiAutomationSettings,
  instantFromLocal,
  localDate,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  NOTIFICATION_TEMPLATE,
  type AiActionError,
  type AiActionResult,
  type AiAutomationRule,
  type AiAutomationSettings,
  type AiOutboundError,
  type AiOutboundTarget,
  type AiProposal,
  type AiProposalStatusEvent,
  type ListAiProposalsQuery,
  type Paginated,
} from "@clinic/shared";
import { and, desc, eq, gt, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { MessageDrafterService } from "@api/ai/outbound/message-drafter.service";
import { OutboundRecipientsService } from "@api/ai/outbound/outbound-recipients.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import type { Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import { aiAuditLog, aiProposals } from "@api/database/schema";
import { NotificationsService } from "@api/notifications/notifications.service";
import { PermissionsService } from "@api/permissions/permissions.service";

/**
 * The screen's read permission for each list a message can go to. Drafting to a list, and seeing
 * a proposal the automation drafted for one, both need it.
 */
export const TARGET_READ_CAPABILITY: Record<AiOutboundTarget, string | null> = {
  [AI_OUTBOUND_TARGET.OVERDUE_LABS]: "lab-orders.overdue",
  [AI_OUTBOUND_TARGET.UNPAID_INVOICES]: "billing.list",
  [AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS]: null,
  [AI_OUTBOUND_TARGET.PATIENT_IDS]: null,
};

/** The `tool_name` of an outbound audit row. Not a tool: the model has no way to send. */
export const OUTBOUND_AUDIT_TOOL = "send_proposal";

/** A refusal with a code the web writes the Arabic for, and the status it is answered with. */
export class OutboundError extends Error {
  constructor(
    readonly code: AiOutboundError,
    readonly status: HttpStatus,
  ) {
    super(code);
    this.name = "OutboundError";
  }
}

export type ProposalRow = typeof aiProposals.$inferSelect;

export interface DraftRequest {
  readonly target: AiOutboundTarget;
  readonly intent: string;
  readonly patientIds?: readonly string[] | undefined;
}

type Claim =
  { readonly ok: true; readonly row: ProposalRow } | { readonly ok: false; readonly expired: true };

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger("Assistant");

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly recipients: OutboundRecipientsService,
    private readonly drafter: MessageDrafterService,
    private readonly notifications: NotificationsService,
    private readonly permissions: PermissionsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** From the chat. The proposal is the caller's own and waits a short while for their click. */
  async draftForUser(
    actor: AuthenticatedUser,
    conversationId: string,
    request: DraftRequest,
  ): Promise<AiProposal> {
    const clinic = await this.recipients.clinic(actor.clinicId);
    const settings = aiAutomationSettings(clinic.settings);
    const ttl = this.config.get("AI_PROPOSAL_TTL_MINUTES", { infer: true });

    return this.draft({
      clinicId: actor.clinicId,
      userId: actor.id,
      conversationId,
      trigger: AI_OUTBOUND_TRIGGER.COMMAND,
      request,
      days: thresholdDays(settings, request.target),
      cap: settings.recipientCap,
      expiresAt: new Date(Date.now() + ttl * 60_000),
    });
  }

  /** From the daily automation. Nobody owns it, and it waits until the clinic's day is over. */
  async draftForRule(
    clinicId: string,
    rule: AiAutomationRule,
    intent: string,
  ): Promise<AiProposal> {
    const clinic = await this.recipients.clinic(clinicId);
    const settings = aiAutomationSettings(clinic.settings);
    const today = localDate(new Date(), clinic.timeZone);

    return this.draft({
      clinicId,
      userId: null,
      conversationId: null,
      trigger: AI_OUTBOUND_TRIGGER.CRON,
      request: { target: rule, intent },
      days: thresholdDays(settings, rule),
      cap: settings.rules[rule].cap,
      expiresAt: instantFromLocal(addDays(today, 1), 0, clinic.timeZone),
    });
  }

  async get(actor: AuthenticatedUser, id: string): Promise<AiProposal> {
    return toProposal(await this.requireVisible(actor, id));
  }

  async list(
    actor: AuthenticatedUser,
    query: ListAiProposalsQuery,
  ): Promise<Paginated<AiProposal>> {
    const where = and(await this.visibleTo(actor), statusFilter(query.status));
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(aiProposals)
        .where(where)
        .orderBy(desc(aiProposals.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(aiProposals)
        .where(where),
    ]);

    return toPaginated(rows.map(toProposal), totals?.value ?? 0, query);
  }

  async cancel(actor: AuthenticatedUser, id: string): Promise<AiProposalStatusEvent> {
    const row = await this.requireVisible(actor, id);

    if (row.status !== AI_PROPOSAL_STATUS.DRAFT) {
      throw new OutboundError(AI_OUTBOUND_ERROR.NOT_PENDING, HttpStatus.CONFLICT);
    }

    const [updated] = await this.db
      .update(aiProposals)
      .set({ status: AI_PROPOSAL_STATUS.CANCELLED, updatedAt: new Date(), updatedBy: actor.id })
      .where(and(eq(aiProposals.id, id), eq(aiProposals.status, AI_PROPOSAL_STATUS.DRAFT)))
      .returning();

    if (!updated) {
      throw new OutboundError(AI_OUTBOUND_ERROR.NOT_PENDING, HttpStatus.CONFLICT);
    }

    return statusEvent(updated);
  }

  /** The confirmation card's button. The capability was checked by the guard; the rest is here. */
  async send(actor: AuthenticatedUser, id: string): Promise<AiProposalStatusEvent> {
    await this.requireVisible(actor, id);

    return this.sendClaimed(actor.clinicId, id, actor.id);
  }

  /** The automation's auto-send: the same checks and caps, with nobody pressing the button. */
  sendAsSystem(clinicId: string, id: string): Promise<AiProposalStatusEvent> {
    return this.sendClaimed(clinicId, id, null);
  }

  private async sendClaimed(
    clinicId: string,
    id: string,
    actorId: string | null,
  ): Promise<AiProposalStatusEvent> {
    const claim = await this.claim(clinicId, id, actorId);

    if (!claim.ok) {
      await this.db
        .update(aiProposals)
        .set({ status: AI_PROPOSAL_STATUS.EXPIRED, updatedAt: new Date() })
        .where(and(eq(aiProposals.id, id), eq(aiProposals.status, AI_PROPOSAL_STATUS.DRAFT)));

      throw new OutboundError(AI_OUTBOUND_ERROR.EXPIRED, HttpStatus.CONFLICT);
    }

    const { row } = claim;
    let sent = 0;
    let failed = 0;

    for (const recipient of row.recipients) {
      const started = Date.now();
      let notificationId: string | null = null;
      let outcome: "sent" | "failed" = "failed";

      try {
        const result = await this.notifications.send({
          clinicId,
          to: recipient.phone,
          template: NOTIFICATION_TEMPLATE.ASSISTANT_MESSAGE,
          vars: { body: recipient.text },
          channel: NOTIFICATION_CHANNEL.WHATSAPP,
        });

        notificationId = result?.id ?? null;
        outcome = result?.status === NOTIFICATION_STATUS.SENT ? "sent" : "failed";
      } catch (error) {
        this.logger.error(`Sending proposal ${id} to one recipient failed: ${String(error)}`);
      }

      if (outcome === "sent") {
        sent += 1;
      } else {
        failed += 1;
      }

      await this.db.insert(aiAuditLog).values({
        clinicId,
        userId: actorId,
        conversationId: row.conversationId,
        toolName: OUTBOUND_AUDIT_TOOL,
        argsJson: { proposal_id: id },
        outcome,
        resultSize: recipient.text.length,
        durationMs: Date.now() - started,
        proposalId: id,
        trigger: row.trigger,
        channel: NOTIFICATION_CHANNEL.WHATSAPP,
        patientId: recipient.patientId,
        recipient: recipient.phone,
        renderedText: recipient.text,
        notificationId,
      });
    }

    const [done] = await this.db
      .update(aiProposals)
      .set({
        status: AI_PROPOSAL_STATUS.SENT,
        sentCount: sent,
        failedCount: failed,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(aiProposals.id, id))
      .returning();

    if (!done) {
      throw new Error(`Proposal ${id} vanished while sending`);
    }

    return statusEvent(done);
  }

  // Under a per-clinic lock, so the daily cap is read and spent in one step: two cards pressed at
  // once cannot each see room for themselves. The claim flips `draft` to `sending`, which is also
  // what stops a double click from sending twice.
  private claim(clinicId: string, id: string, actorId: string | null): Promise<Claim> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai-outbound:${clinicId}`}))`);

      const [row] = await tx
        .select()
        .from(aiProposals)
        .where(
          and(
            eq(aiProposals.id, id),
            eq(aiProposals.clinicId, clinicId),
            eq(aiProposals.kind, AI_PROPOSAL_KIND.MESSAGE),
          ),
        )
        .for("update");

      if (!row) {
        throw new NotFoundException("Resource not found");
      }

      if (row.status === AI_PROPOSAL_STATUS.EXPIRED) {
        throw new OutboundError(AI_OUTBOUND_ERROR.EXPIRED, HttpStatus.CONFLICT);
      }

      if (row.status !== AI_PROPOSAL_STATUS.DRAFT) {
        throw new OutboundError(AI_OUTBOUND_ERROR.NOT_PENDING, HttpStatus.CONFLICT);
      }

      if (row.expiresAt.getTime() <= Date.now()) {
        return { ok: false, expired: true } as const;
      }

      const clinic = await this.recipients.clinic(clinicId);
      const settings = aiAutomationSettings(clinic.settings);

      // Settings may have tightened since the draft; the cap in force at the click is the one.
      if (row.recipientCount > recipientCap(settings, row)) {
        throw new OutboundError(AI_OUTBOUND_ERROR.RECIPIENT_CAP, HttpStatus.UNPROCESSABLE_ENTITY);
      }

      if (!(await this.notifications.settingsFor(clinicId)).enabled) {
        throw new OutboundError(
          AI_OUTBOUND_ERROR.NOTIFICATIONS_DISABLED,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const midnight = instantFromLocal(localDate(new Date(), clinic.timeZone), 0, clinic.timeZone);
      const [used] = await tx
        .select({ value: sql<number>`coalesce(sum(${aiProposals.recipientCount}), 0)::int` })
        .from(aiProposals)
        .where(
          and(
            eq(aiProposals.clinicId, clinicId),
            inArray(aiProposals.status, [AI_PROPOSAL_STATUS.SENDING, AI_PROPOSAL_STATUS.SENT]),
            gte(aiProposals.sentAt, midnight),
          ),
        );

      if ((used?.value ?? 0) + row.recipientCount > settings.dailyCap) {
        throw new OutboundError(AI_OUTBOUND_ERROR.DAILY_CAP, HttpStatus.UNPROCESSABLE_ENTITY);
      }

      const [claimed] = await tx
        .update(aiProposals)
        .set({
          status: AI_PROPOSAL_STATUS.SENDING,
          sentAt: new Date(),
          sentBy: actorId,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(aiProposals.id, id))
        .returning();

      if (!claimed) {
        throw new NotFoundException("Resource not found");
      }

      return { ok: true, row: claimed } as const;
    });
  }

  private async draft(input: {
    clinicId: string;
    userId: string | null;
    conversationId: string | null;
    trigger: AiProposal["trigger"];
    request: DraftRequest;
    days: number;
    cap: number;
    expiresAt: Date;
  }): Promise<AiProposal> {
    const resolved = await this.recipients.resolve({
      clinicId: input.clinicId,
      target: input.request.target,
      days: input.days,
      patientIds: input.request.patientIds,
      limit: input.cap,
    });

    // Refused whole: sending to the first hundred of a longer list is a choice nobody made.
    if (resolved.overflow) {
      throw new OutboundError(AI_OUTBOUND_ERROR.RECIPIENT_CAP, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    if (resolved.candidates.length === 0) {
      throw new OutboundError(AI_OUTBOUND_ERROR.NO_RECIPIENTS, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const messages = await this.drafter.draft(
      input.clinicId,
      input.request.target,
      input.request.intent,
      resolved.candidates,
    );

    const [row] = await this.db
      .insert(aiProposals)
      .values({
        clinicId: input.clinicId,
        userId: input.userId,
        conversationId: input.conversationId,
        trigger: input.trigger,
        target: input.request.target,
        intent: input.request.intent,
        recipients: messages,
        recipientCount: messages.length,
        expiresAt: input.expiresAt,
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the proposal");
    }

    return toProposal(row);
  }

  private async requireVisible(actor: AuthenticatedUser, id: string): Promise<ProposalRow> {
    const [row] = await this.db
      .select()
      .from(aiProposals)
      .where(and(eq(aiProposals.id, id), await this.visibleTo(actor)))
      .limit(1);

    if (!row) {
      // Somebody else's proposal is a 404, like somebody else's conversation.
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  // The author's own, or the automation's — and of those only the lists this role may read: the
  // unpaid-balances proposal quotes every debt, and a role kept off billing must not read it here.
  private async visibleTo(actor: AuthenticatedUser): Promise<SQL | undefined> {
    const readable: AiOutboundTarget[] = [];

    for (const target of AI_OUTBOUND_TARGETS) {
      const capability = TARGET_READ_CAPABILITY[target];

      if (
        capability === null ||
        (await this.permissions.allows(actor.clinicId, actor.role, capability))
      ) {
        readable.push(target);
      }
    }

    // Messages only: an action is confirmed through its own route, which checks its own permission.
    return and(
      eq(aiProposals.clinicId, actor.clinicId),
      eq(aiProposals.kind, AI_PROPOSAL_KIND.MESSAGE),
      or(
        eq(aiProposals.userId, actor.id),
        and(isNull(aiProposals.userId), inArray(aiProposals.target, readable)),
      ),
    );
  }
}

function thresholdDays(settings: AiAutomationSettings, target: AiOutboundTarget): number {
  switch (target) {
    case AI_OUTBOUND_TARGET.OVERDUE_LABS:
      return settings.rules.overdue_labs.days;
    case AI_OUTBOUND_TARGET.UNPAID_INVOICES:
      return settings.rules.unpaid_invoices.days;
    default:
      return 0;
  }
}

function recipientCap(settings: AiAutomationSettings, row: ProposalRow): number {
  if (
    row.trigger === AI_OUTBOUND_TRIGGER.COMMAND ||
    row.target === null ||
    row.target === AI_OUTBOUND_TARGET.PATIENT_IDS
  ) {
    return settings.recipientCap;
  }

  return settings.rules[row.target].cap;
}

function statusFilter(status: ListAiProposalsQuery["status"]): SQL | undefined {
  const now = new Date();

  switch (status) {
    case undefined:
      return undefined;
    case AI_PROPOSAL_STATUS.DRAFT:
      return and(eq(aiProposals.status, AI_PROPOSAL_STATUS.DRAFT), gt(aiProposals.expiresAt, now));
    case AI_PROPOSAL_STATUS.EXPIRED:
      return or(
        eq(aiProposals.status, AI_PROPOSAL_STATUS.EXPIRED),
        and(eq(aiProposals.status, AI_PROPOSAL_STATUS.DRAFT), lte(aiProposals.expiresAt, now)),
      );
    default:
      return eq(aiProposals.status, status);
  }
}

/** A draft past its time reads as expired whether or not anybody has tried it since. */
const servedStatus = (row: ProposalRow): AiProposal["status"] =>
  row.status === AI_PROPOSAL_STATUS.DRAFT && row.expiresAt.getTime() <= Date.now()
    ? AI_PROPOSAL_STATUS.EXPIRED
    : row.status;

export const toProposal = (row: ProposalRow): AiProposal => ({
  id: row.id,
  kind: row.kind,
  status: servedStatus(row),
  trigger: row.trigger,
  target: row.target,
  intent: row.intent,
  conversationId: row.conversationId,
  createdBy: row.userId,
  recipients: row.recipients.map(({ patientId, name, text }) => ({ patientId, name, text })),
  expiresAt: row.expiresAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  sentAt: row.sentAt?.toISOString() ?? null,
  sentCount: row.sentCount,
  failedCount: row.failedCount,
  tier: row.tier,
  typedPhrase: row.typedPhrase,
  summary: row.resolvedSummary,
  result: toResult(row),
  error: toActionError(row.errorCode),
});

export const statusEvent = (row: ProposalRow): AiProposalStatusEvent => ({
  type: AI_STREAM_EVENT.PROPOSAL_STATUS,
  proposalId: row.id,
  status: servedStatus(row),
  sentCount: row.sentCount,
  failedCount: row.failedCount,
  ...(row.kind !== AI_PROPOSAL_KIND.MESSAGE && {
    result: toResult(row),
    error: toActionError(row.errorCode),
  }),
});

function toResult(row: ProposalRow): AiActionResult | null {
  const entity = AI_ACTION_ENTITIES.find((candidate) => candidate === row.resultEntity);

  return entity && row.resultId
    ? { entity, id: row.resultId, patientId: row.resultPatientId }
    : null;
}

const toActionError = (code: string | null): AiActionError | null =>
  code === null
    ? null
    : (AI_ACTION_ERRORS.find((known) => known === code) ?? AI_ACTION_ERROR.FAILED);
