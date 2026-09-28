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

export interface StoredRecipient {
  readonly patientId: string;
  readonly name: string;
  readonly phone: string;
  readonly text: string;
}

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
    title: text("title").notNull(),
    loadedGroups: jsonb("loaded_groups").$type<string[]>().notNull().default([]),
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
    toolName: text("tool_name"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    promptVersion: integer("prompt_version"),
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    view: jsonb("view").$type<AiView>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("ai_messages_conversation_idx").on(table.conversationId, table.createdAt)],
);

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
    outcome: text("outcome").notNull(),
    resultSize: integer("result_size").notNull(),
    durationMs: integer("duration_ms").notNull(),
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    trigger: aiOutboundTriggerEnum("trigger"),
    channel: notificationChannelEnum("channel"),
    patientId: uuid("patient_id").references(() => patients.id),
    recipient: text("recipient"),
    renderedText: text("rendered_text"),
    notificationId: uuid("notification_id").references(() => notificationsLog.id),
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

export const aiProposals = pgTable(
  "ai_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id").references(() => users.id),
    conversationId: uuid("conversation_id").references(() => aiConversations.id),
    kind: aiProposalKindEnum("kind").notNull().default("message"),
    trigger: aiOutboundTriggerEnum("trigger").notNull(),
    target: aiOutboundTargetEnum("target"),
    intent: text("intent"),
    recipients: jsonb("recipients").$type<StoredRecipient[]>().notNull().default([]),
    recipientCount: integer("recipient_count").notNull().default(0),
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
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ai_automation_runs_uniq").on(table.clinicId, table.rule, table.runDate)],
);

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
    hint: text("hint").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (table) => [uniqueIndex("clinic_secrets_kind_uniq").on(table.clinicId, table.kind)],
);
