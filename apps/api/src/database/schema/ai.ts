import { AI_MESSAGE_ROLES } from "@clinic/shared";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinics, users } from "@api/database/schema/core";

export const aiMessageRoleEnum = pgEnum("ai_message_role", AI_MESSAGE_ROLES);

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_audit_log_clinic_created_idx").on(table.clinicId, table.createdAt),
    index("ai_audit_log_conversation_idx").on(table.conversationId),
  ],
);
