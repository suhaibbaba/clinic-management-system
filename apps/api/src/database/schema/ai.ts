import {
  AI_PROPOSAL_KINDS,
  AI_RISK_TIERS,
  type AiActionSummary,
  type AiView,
  AI_AUTOMATION_RULES,
  AI_AUTOMATION_RUN_STATUSES,
  AI_MESSAGE_ROLES,
  AI_OUTBOUND_TARGETS,
  AI_OUTBOUND_TRIGGERS,
  AI_PROPOSAL_STATUSES,
  CLINIC_SECRET_KINDS,
} from "@clinic/shared";
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clinics, users } from "@api/database/schema/core";
import { notificationChannelEnum, notificationsLog } from "@api/database/schema/notifications";
import { patients } from "@api/database/schema/patients";

export const aiMessageRoleEnum = pgEnum("ai_message_role", AI_MESSAGE_ROLES);
export const aiProposalKindEnum = pgEnum("ai_proposal_kind", AI_PROPOSAL_KINDS);
export const aiRiskTierEnum = pgEnum("ai_risk_tier", AI_RISK_TIERS);
export const aiProposalStatusEnum = pgEnum("ai_proposal_status", AI_PROPOSAL_STATUSES);
export const aiOutboundTargetEnum = pgEnum("ai_outbound_target", AI_OUTBOUND_TARGETS);
export const aiOutboundTriggerEnum = pgEnum("ai_outbound_trigger", AI_OUTBOUND_TRIGGERS);
export const aiAutomationRuleEnum = pgEnum("ai_automation_rule", AI_AUTOMATION_RULES);
export const clinicSecretKindEnum = pgEnum("clinic_secret_kind", CLINIC_SECRET_KINDS);
export const aiAutomationRunStatusEnum = pgEnum(
  "ai_automation_run_status",
  AI_AUTOMATION_RUN_STATUSES,
);

/** As drafted and as sent: the phone stays server-side, the card is served without it. */
export interface StoredRecipient {
  readonly patientId: string;
  readonly name: string;
  readonly phone: string;
  readonly text: string;
}

// A conversation belongs to the person who had it, not to the clinic at large: it quotes their
// patients' records back at them, and another receptionist reading it is a leak the role check on
// the original answer already refused.
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** Taken from the first question; an admin may rename it. */
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("ai_conversations_owner_idx").on(table.clinicId, table.userId, table.updatedAt),
  ],
);

// Written as the turn runs, so a stream the browser drops still leaves the answer behind. `content`
// on a tool row is the envelope the model was handed, which is what makes an answer reproducible.
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id),
    role: aiMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    /** Text rather than an enum: adding a tool is not a migration. */
    toolName: text("tool_name"),
    // Set on an `assistant` row only. The per-clinic daily budget is `sum()` over these for the
    // clinic's own day — a running total would be a stored figure that drifts.
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    /** Which `SYSTEM_PROMPT_VERSION` answered, so an old reply is read under the rules it had. */
    promptVersion: integer("prompt_version"),
    /** On the tool row that drafted one, so a reloaded thread draws the card where it was. */
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    /** On a tool row: the table or card the page drew. The model is never handed it. */
    view: jsonb("view").$type<AiView>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("ai_messages_conversation_idx").on(table.conversationId, table.createdAt)],
);

// Insert-only, like `audit_log`: every tool the model ran, on whose behalf, and how much came back.
// The arguments are stored, the result never is — it is the patient record itself.
export const aiAuditLog = pgTable(
  "ai_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id").references(() => users.id),
    conversationId: uuid("conversation_id").references(() => aiConversations.id),
    toolName: text("tool_name").notNull(),
    argsJson: jsonb("args_json"),
    /** `ok`, or the tool error code that stopped it. */
    outcome: text("outcome").notNull(),
    /** Characters of the envelope handed to the model — a leak shows up as a size, not a body. */
    resultSize: integer("result_size").notNull(),
    durationMs: integer("duration_ms").notNull(),
    // The outbound columns, set on one row per message sent. The text is kept, unlike a tool
    // result: it left the clinic, and what was said to a patient is the thing an audit asks.
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    trigger: aiOutboundTriggerEnum("trigger"),
    channel: notificationChannelEnum("channel"),
    patientId: uuid("patient_id").references(() => patients.id),
    recipient: text("recipient"),
    renderedText: text("rendered_text"),
    notificationId: uuid("notification_id").references(() => notificationsLog.id),
    /** What an action changed, beside the domain's own audit entry for the same row. */
    entity: text("entity"),
    entityId: uuid("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_audit_log_clinic_created_idx").on(table.clinicId, table.createdAt),
    index("ai_audit_log_conversation_idx").on(table.conversationId),
    index("ai_audit_log_proposal_idx").on(table.proposalId),
  ],
);

// Every pending action: a drafted bulk message, or a change the model proposed. The model can create
// one and nothing else — running it is a person pressing the card's button, against a row whose
// clinic, author, expiry and tier the server checks again at the click.
export const aiProposals = pgTable(
  "ai_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    /** Null when the daily automation drafted it; any holder of the send permission may act. */
    userId: uuid("user_id").references(() => users.id),
    conversationId: uuid("conversation_id").references(() => aiConversations.id),
    kind: aiProposalKindEnum("kind").notNull().default("message"),
    trigger: aiOutboundTriggerEnum("trigger").notNull(),
    /** A message's audience; null on an action. */
    target: aiOutboundTargetEnum("target"),
    intent: text("intent"),
    recipients: jsonb("recipients").$type<StoredRecipient[]>().notNull().default([]),
    recipientCount: integer("recipient_count").notNull().default(0),
    /** An action's validated arguments, ids resolved by the server — what runs on confirm. */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    tier: aiRiskTierEnum("tier"),
    typedPhrase: text("typed_phrase"),
    resolvedSummary: jsonb("resolved_summary").$type<AiActionSummary>(),
    resultEntity: text("result_entity"),
    resultId: uuid("result_id"),
    resultPatientId: uuid("result_patient_id"),
    errorCode: text("error_code"),
    status: aiProposalStatusEnum("status").notNull().default("draft"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set when the send is claimed: the daily cap counts from here. */
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentBy: uuid("sent_by").references(() => users.id),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("ai_proposals_clinic_status_idx").on(table.clinicId, table.status, table.createdAt),
    index("ai_proposals_clinic_sent_idx").on(table.clinicId, table.sentAt),
  ],
);

// The idempotency guard: one row per clinic, rule and clinic-local day, claimed before anything is
// drafted. A second run finds the row and does nothing, whatever became of the first.
export const aiAutomationRuns = pgTable(
  "ai_automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    rule: aiAutomationRuleEnum("rule").notNull(),
    runDate: date("run_date").notNull(),
    status: aiAutomationRunStatusEnum("status").notNull().default("running"),
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    recipientCount: integer("recipient_count").notNull().default(0),
    /** A code or a short diagnostic; never shown to a patient. */
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ai_automation_runs_uniq").on(table.clinicId, table.rule, table.runDate)],
);

// AES-256-GCM under SECRETS_MASTER_KEY, with the clinic and the kind as authenticated data, so a
// value copied into another clinic's row fails to decrypt. Cleared by deleting the row: a secret
// is not a medical or financial record, and a lingering ciphertext is only a liability.
export const clinicSecrets = pgTable(
  "clinic_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    kind: clinicSecretKindEnum("kind").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    /** The last four characters, the only part of the value any screen is shown. */
    hint: text("hint").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (table) => [uniqueIndex("clinic_secrets_kind_uniq").on(table.clinicId, table.kind)],
);
