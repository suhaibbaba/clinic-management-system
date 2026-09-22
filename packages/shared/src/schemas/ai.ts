import { z } from "zod";
import {
  AI_AUTOMATION_MODE,
  AI_AUTOMATION_MODES,
  AI_ERROR_CODES,
  AI_MESSAGE_ROLES,
  AI_OUTBOUND_TARGETS,
  AI_OUTBOUND_TRIGGERS,
  AI_PROPOSAL_STATUSES,
  AI_STREAM_EVENT,
  AI_TOOL_NAMES,
  CLINIC_SECRET_KIND,
  CLINIC_SECRET_KINDS,
  NOTIFICATION_CHANNELS,
} from "@shared/enums";
import { paginationQuerySchema, uuidSchema } from "@shared/schemas/common";

/** A question, not a document: anything longer is a paste the agent has no use for. */
export const AI_MESSAGE_MAX_LENGTH = 2000;
export const AI_TITLE_MAX_LENGTH = 120;

export const aiChatRequestSchema = z.object({
  /** Omitted starts a conversation; the stream's first frame carries the new id. */
  conversationId: uuidSchema.optional(),
  message: z.string().trim().min(1).max(AI_MESSAGE_MAX_LENGTH),
});
export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

export const aiConversationSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AiConversation = z.infer<typeof aiConversationSchema>;

export const aiMessageSchema = z.object({
  id: uuidSchema,
  role: z.enum(AI_MESSAGE_ROLES),
  content: z.string(),
  /** Set on a `tool` row only: which tool answered. */
  toolName: z.enum(AI_TOOL_NAMES).nullable(),
  /** Set on the row that drafted a proposal: the thread draws its confirmation card there. */
  proposalId: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type AiMessage = z.infer<typeof aiMessageSchema>;

export const listAiConversationsQuerySchema = paginationQuerySchema;
export type ListAiConversationsQuery = z.infer<typeof listAiConversationsQuerySchema>;

export const renameAiConversationSchema = z.object({
  title: z.string().trim().min(1).max(AI_TITLE_MAX_LENGTH),
});
export type RenameAiConversationInput = z.infer<typeof renameAiConversationSchema>;

export const aiProposalRecipientSchema = z.object({
  patientId: uuidSchema,
  name: z.string(),
  /** Exactly what the patient will receive. */
  text: z.string(),
});
export type AiProposalRecipient = z.infer<typeof aiProposalRecipientSchema>;

// No phone numbers: the card is for checking who and what, and the number is on the patient's file.
export const aiProposalSchema = z.object({
  id: uuidSchema,
  status: z.enum(AI_PROPOSAL_STATUSES),
  trigger: z.enum(AI_OUTBOUND_TRIGGERS),
  target: z.enum(AI_OUTBOUND_TARGETS),
  intent: z.string(),
  conversationId: uuidSchema.nullable(),
  /** Null for a proposal the daily automation made. */
  createdBy: uuidSchema.nullable(),
  recipients: z.array(aiProposalRecipientSchema),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  sentAt: z.iso.datetime().nullable(),
  sentCount: z.number().int(),
  failedCount: z.number().int(),
});
export type AiProposal = z.infer<typeof aiProposalSchema>;

export const listAiProposalsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(AI_PROPOSAL_STATUSES).optional(),
});
export type ListAiProposalsQuery = z.infer<typeof listAiProposalsQuerySchema>;

export const AI_RECIPIENT_CAP_MAX = 500;

const capSchema = z.number().int().min(1).max(AI_RECIPIENT_CAP_MAX);
const thresholdDaysSchema = z.number().int().min(1).max(365);

const ruleSchema = (days: number) =>
  z.object({
    mode: z.enum(AI_AUTOMATION_MODES).default(AI_AUTOMATION_MODE.PROPOSE),
    days: thresholdDaysSchema.default(days),
    cap: capSchema.default(100),
  });

// Everything proposes out of the box: nothing reaches a patient until a clinic chooses auto-send.
export const aiAutomationSettingsSchema = z.object({
  rules: z
    .object({
      overdue_labs: ruleSchema(7).prefault({}),
      unpaid_invoices: ruleSchema(30).prefault({}),
      tomorrow_appointments: z
        .object({
          mode: z.enum(AI_AUTOMATION_MODES).default(AI_AUTOMATION_MODE.PROPOSE),
          cap: capSchema.default(100),
        })
        .prefault({}),
    })
    .prefault({}),
  /** The most recipients one proposal drafted from the chat may carry. */
  recipientCap: capSchema.default(100),
  /** Messages the clinic may send in its own day, from the chat and the automation together. */
  dailyCap: z.number().int().min(1).max(5_000).default(300),
});
export type AiAutomationSettings = z.infer<typeof aiAutomationSettingsSchema>;

export const AI_AUTOMATION_SETTINGS_KEY = "assistant";

/** Never throws: an unreadable setting falls back to the defaults, which only ever propose. */
export function aiAutomationSettings(settings: unknown): AiAutomationSettings {
  const raw =
    typeof settings === "object" && settings !== null
      ? (settings as Record<string, unknown>)[AI_AUTOMATION_SETTINGS_KEY]
      : undefined;

  const parsed = aiAutomationSettingsSchema.safeParse(raw ?? {});

  return parsed.success ? parsed.data : aiAutomationSettingsSchema.parse({});
}

export const aiOutboundLogEntrySchema = z.object({
  id: uuidSchema,
  proposalId: uuidSchema.nullable(),
  trigger: z.enum(AI_OUTBOUND_TRIGGERS),
  channel: z.enum(NOTIFICATION_CHANNELS),
  patientId: uuidSchema.nullable(),
  patientName: z.string().nullable(),
  recipient: z.string(),
  text: z.string(),
  /** Null when the automation sent it. */
  userId: uuidSchema.nullable(),
  /** `sent`, or `failed` when the gateway refused it. */
  outcome: z.string(),
  createdAt: z.iso.datetime(),
});
export type AiOutboundLogEntry = z.infer<typeof aiOutboundLogEntrySchema>;

export const listAiOutboundQuerySchema = paginationQuerySchema.extend({
  trigger: z.enum(AI_OUTBOUND_TRIGGERS).optional(),
  outcome: z.enum(["sent", "failed"]).optional(),
  proposalId: uuidSchema.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type ListAiOutboundQuery = z.infer<typeof listAiOutboundQuerySchema>;

export const aiProposalStatusEventSchema = z.object({
  type: z.literal(AI_STREAM_EVENT.PROPOSAL_STATUS),
  proposalId: uuidSchema,
  status: z.enum(AI_PROPOSAL_STATUSES),
  sentCount: z.number().int(),
  failedCount: z.number().int(),
});
export type AiProposalStatusEvent = z.infer<typeof aiProposalStatusEventSchema>;

// The SSE frames, as a union so the web exhausts them. Nothing here is a user-facing string: a
// failure is a code and the front end writes the Arabic (CLAUDE.md).
export const aiStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(AI_STREAM_EVENT.CONVERSATION), conversationId: uuidSchema }),
  z.object({ type: z.literal(AI_STREAM_EVENT.TOOL), tool: z.enum(AI_TOOL_NAMES) }),
  z.object({ type: z.literal(AI_STREAM_EVENT.DELTA), text: z.string() }),
  z.object({ type: z.literal(AI_STREAM_EVENT.DONE), messageId: uuidSchema }),
  z.object({ type: z.literal(AI_STREAM_EVENT.ERROR), code: z.enum(AI_ERROR_CODES) }),
  z.object({ type: z.literal(AI_STREAM_EVENT.PROPOSAL), proposal: aiProposalSchema }),
  aiProposalStatusEventSchema,
]);
export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>;

export const clinicSecretStatusSchema = z.object({
  set: z.boolean(),
  /** The last four characters, for recognising which key is in place. Null when unset. */
  hint: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});
export type ClinicSecretStatus = z.infer<typeof clinicSecretStatusSchema>;

export const clinicSecretsSchema = z.object({
  /** False when the server has no master key: values cannot be stored, only cleared. */
  encryptionAvailable: z.boolean(),
  secrets: z.record(z.enum(CLINIC_SECRET_KINDS), clinicSecretStatusSchema),
});
export type ClinicSecrets = z.infer<typeof clinicSecretsSchema>;

// Each field: a string sets it, null clears it, absent leaves it alone. The formats are checked
// here so a pasted label or a stray space never becomes a stored credential.
export const updateClinicSecretsSchema = z
  .object({
    [CLINIC_SECRET_KIND.OPENAI_API_KEY]: z
      .string()
      .trim()
      .regex(/^sk-[A-Za-z0-9_-]{20,200}$/)
      .nullable()
      .optional(),
    [CLINIC_SECRET_KIND.WHATSAPP_ACCESS_TOKEN]: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{20,1000}$/)
      .nullable()
      .optional(),
    [CLINIC_SECRET_KIND.WHATSAPP_PHONE_NUMBER_ID]: z
      .string()
      .trim()
      .regex(/^\d{5,30}$/)
      .nullable()
      .optional(),
    [CLINIC_SECRET_KIND.WHATSAPP_TEMPLATE_NAME]: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{1,512}$/)
      .nullable()
      .optional(),
  })
  .strict();
export type UpdateClinicSecretsInput = z.infer<typeof updateClinicSecretsSchema>;
