import { z } from "zod";
import {
  AI_ACTION_ERRORS,
  AI_ACTION_TOOLS,
  AI_PROPOSAL_KINDS,
  AI_RISK_TIERS,
  AI_SCHEDULE_CONFLICT_CHOICES,
  APPOINTMENT_STATUSES,
  LAB_ORDER_STATUSES,
  MOVEMENT_TYPES,
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
import {
  paginationQuerySchema,
  timeRangeSchema,
  uuidSchema,
  weekdaySchema,
} from "@shared/schemas/common";
import { moneySchema } from "@shared/schemas/money";
import { personNameSchema } from "@shared/schemas/person-name";

export const AI_MESSAGE_MAX_LENGTH = 2000;
export const AI_TITLE_MAX_LENGTH = 120;

export const aiChatRequestSchema = z.object({
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

export const AI_VIEW_COLUMN_KINDS = [
  "text",
  "number",
  "date",
  "time",
  "money",
  "status",
  "code",
  "phone",
  "link",
  "person",
] as const;
export type AiViewColumnKind = (typeof AI_VIEW_COLUMN_KINDS)[number];

export const aiViewColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(AI_VIEW_COLUMN_KINDS),
  prefix: z.string().optional(),
});
export type AiViewColumn = z.infer<typeof aiViewColumnSchema>;

export const aiViewLinkSchema = z.object({ href: z.string().startsWith("/"), label: z.string() });
export type AiViewLink = z.infer<typeof aiViewLinkSchema>;

export const aiTableViewSchema = z.object({
  type: z.literal("table"),
  columns: z.array(aiViewColumnSchema),
  rows: z.array(z.record(z.string(), z.unknown())),
  truncated: z.boolean(),
  total: z.number().int().optional(),
  href: z.string().startsWith("/").optional(),
});
export type AiTableView = z.infer<typeof aiTableViewSchema>;

export const aiStatTileSchema = z.object({
  label: z.string(),
  value: z.string(),
  kind: z.enum(["number", "money"]),
});
export type AiStatTile = z.infer<typeof aiStatTileSchema>;

export const aiViewSchema = z.discriminatedUnion("type", [
  aiTableViewSchema,
  z.object({
    type: z.literal("stats"),
    tiles: z.array(aiStatTileSchema).min(1).max(4),
    table: aiTableViewSchema.optional(),
  }),
  z.object({
    type: z.literal("patient"),
    patient: z.object({
      id: uuidSchema,
      fullName: z.string(),
      fileNumber: z.string(),
      phone: z.string(),
    }),
    balance: z.string().optional(),
    table: aiTableViewSchema,
  }),
  z.object({
    type: z.literal("list"),
    items: z.array(
      z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        date: z.string().optional(),
        href: z.string().startsWith("/").optional(),
      }),
    ),
    truncated: z.boolean(),
    total: z.number().int().optional(),
    href: z.string().startsWith("/").optional(),
  }),
]);
export type AiView = z.infer<typeof aiViewSchema>;

export const aiMessageSchema = z.object({
  id: uuidSchema,
  role: z.enum(AI_MESSAGE_ROLES),
  content: z.string(),
  toolName: z.enum(AI_TOOL_NAMES).nullable(),
  proposalId: uuidSchema.nullable(),
  view: aiViewSchema.nullable(),
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
  text: z.string(),
});
export type AiProposalRecipient = z.infer<typeof aiProposalRecipientSchema>;

const actionSummaryFields = z.object({
  patient: z.object({ id: uuidSchema, fullName: z.string(), fileNumber: z.string() }).optional(),
  doctor: z.object({ id: uuidSchema, name: personNameSchema }).optional(),
  newPatient: z
    .object({ fullName: z.string(), phone: z.string(), dateOfBirth: z.string().nullable() })
    .optional(),
  startsAt: z.iso.datetime().optional(),
  previousStartsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().optional(),
  previousEndsAt: z.iso.datetime().optional(),
  startsOn: z.iso.date().optional(),
  endsOn: z.iso.date().optional(),
  onConflict: z.enum(AI_SCHEDULE_CONFLICT_CHOICES).optional(),
  durationMinutes: z.number().int().optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  reason: z.string().optional(),
  note: z.string().optional(),
  amount: moneySchema.optional(),
  method: z.string().optional(),
  labOrder: z
    .object({
      id: uuidSchema,
      labName: z.string(),
      workTypeName: z.string().nullable(),
      status: z.enum(LAB_ORDER_STATUSES),
    })
    .optional(),
  labStatus: z.enum(LAB_ORDER_STATUSES).optional(),
  stockItem: z.object({ id: uuidSchema, name: z.string(), unit: z.string() }).optional(),
  movementType: z.enum(MOVEMENT_TYPES).optional(),
  quantity: z.string().optional(),
  lab: z.object({ id: uuidSchema, name: z.string() }).optional(),
  recordedAt: z.iso.datetime().optional(),
  scheduleChanges: z
    .array(
      z.object({
        weekday: weekdaySchema,
        before: z.array(timeRangeSchema),
        after: z.array(timeRangeSchema),
      }),
    )
    .optional(),
  outsideHours: z.boolean().optional(),
  route: z
    .object({
      tool: z.string(),
      capability: z.string().nullable(),
      fields: z.array(z.object({ name: z.string(), value: z.string() })),
    })
    .optional(),
  extraHours: z.object({ date: z.iso.date(), ranges: z.array(timeRangeSchema) }).optional(),
  appointments: z
    .array(
      z.object({
        id: uuidSchema,
        startsAt: z.iso.datetime(),
        patientName: z.string(),
        patientFileNumber: z.string(),
        doctorName: personNameSchema,
      }),
    )
    .optional(),
});
export const AI_PLAN_STEP_STATUSES = ["pending", "done", "failed"] as const;
export type AiPlanStepStatus = (typeof AI_PLAN_STEP_STATUSES)[number];

export const aiPlanInputSchema = z.object({
  name: z.string(),
  kind: z.enum(["time", "date", "text"]),
});
export type AiPlanInput = z.infer<typeof aiPlanInputSchema>;

export const aiPlanStepSchema = z.object({
  kind: z.enum(AI_PROPOSAL_KINDS),
  summary: actionSummaryFields,
  note: z.string().optional(),
  needs: z.array(aiPlanInputSchema).optional(),
  status: z.enum(AI_PLAN_STEP_STATUSES).optional(),
  error: z.enum(AI_ACTION_ERRORS).optional(),
  resultId: z.string().optional(),
});
export type AiPlanStep = z.infer<typeof aiPlanStepSchema>;

export const aiActionSummarySchema = actionSummaryFields.extend({
  title: z.string().optional(),
  steps: z.array(aiPlanStepSchema).optional(),
});
export type AiActionSummary = z.infer<typeof aiActionSummarySchema>;
export type AiActionStepSummary = z.infer<typeof actionSummaryFields>;

export const AI_ACTION_ENTITIES = ["appointment", "patient", "payment"] as const;

export const aiActionResultSchema = z.object({
  entity: z.enum(AI_ACTION_ENTITIES),
  id: uuidSchema,
  patientId: uuidSchema.nullable(),
});
export type AiActionResult = z.infer<typeof aiActionResultSchema>;

export const aiProposalSchema = z.object({
  id: uuidSchema,
  kind: z.enum(AI_PROPOSAL_KINDS),
  status: z.enum(AI_PROPOSAL_STATUSES),
  trigger: z.enum(AI_OUTBOUND_TRIGGERS),
  target: z.enum(AI_OUTBOUND_TARGETS).nullable(),
  intent: z.string().nullable(),
  conversationId: uuidSchema.nullable(),
  createdBy: uuidSchema.nullable(),
  recipients: z.array(aiProposalRecipientSchema),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  sentAt: z.iso.datetime().nullable(),
  sentCount: z.number().int(),
  failedCount: z.number().int(),
  tier: z.enum(AI_RISK_TIERS).nullable(),
  typedPhrase: z.string().nullable(),
  summary: aiActionSummarySchema.nullable(),
  result: aiActionResultSchema.nullable(),
  error: z.enum(AI_ACTION_ERRORS).nullable(),
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
  recipientCap: capSchema.default(100),
  dailyCap: z.number().int().min(1).max(5_000).default(300),
});
export type AiAutomationSettings = z.infer<typeof aiAutomationSettingsSchema>;

export const AI_AUTOMATION_SETTINGS_KEY = "assistant";

export function aiAutomationSettings(settings: unknown): AiAutomationSettings {
  const raw =
    typeof settings === "object" && settings !== null
      ? (settings as Record<string, unknown>)[AI_AUTOMATION_SETTINGS_KEY]
      : undefined;

  const parsed = aiAutomationSettingsSchema.safeParse(raw ?? {});

  return parsed.success ? parsed.data : aiAutomationSettingsSchema.parse({});
}

export const aiPlanInputsSchema = z.record(
  z.string().regex(/^\d+$/),
  z.record(z.string().max(64), z.string().trim().min(1).max(200)),
);
export type AiPlanInputs = z.infer<typeof aiPlanInputsSchema>;

export const confirmAiProposalSchema = z.object({
  typedPhrase: z.string().max(200).optional(),
  inputs: aiPlanInputsSchema.optional(),
});
export type ConfirmAiProposalInput = z.infer<typeof confirmAiProposalSchema>;

export const aiActionsSettingsSchema = z.object({
  disabled: z.array(z.enum(AI_ACTION_TOOLS)).max(AI_ACTION_TOOLS.length).default([]),
  minTier: z.partialRecord(z.enum(AI_ACTION_TOOLS), z.enum(AI_RISK_TIERS)).default({}),
  paymentTypedAbove: z.number().int().min(1).max(99_999_999).default(500),
  cancelTypedAbove: z.number().int().min(0).max(50).default(1),
});
export type AiActionsSettings = z.infer<typeof aiActionsSettingsSchema>;

export const AI_ACTIONS_SETTINGS_KEY = "assistantActions";

export function aiActionsSettings(settings: unknown): AiActionsSettings {
  const raw =
    typeof settings === "object" && settings !== null
      ? (settings as Record<string, unknown>)[AI_ACTIONS_SETTINGS_KEY]
      : undefined;

  const parsed = aiActionsSettingsSchema.safeParse(raw ?? {});

  return parsed.success ? parsed.data : aiActionsSettingsSchema.parse({});
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
  userId: uuidSchema.nullable(),
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
  result: aiActionResultSchema.nullable().optional(),
  error: z.enum(AI_ACTION_ERRORS).nullable().optional(),
});
export type AiProposalStatusEvent = z.infer<typeof aiProposalStatusEventSchema>;

export const aiStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(AI_STREAM_EVENT.CONVERSATION), conversationId: uuidSchema }),
  z.object({ type: z.literal(AI_STREAM_EVENT.TOOL), tool: z.enum(AI_TOOL_NAMES) }),
  z.object({ type: z.literal(AI_STREAM_EVENT.DELTA), text: z.string() }),
  z.object({ type: z.literal(AI_STREAM_EVENT.DONE), messageId: uuidSchema }),
  z.object({ type: z.literal(AI_STREAM_EVENT.ERROR), code: z.enum(AI_ERROR_CODES) }),
  z.object({ type: z.literal(AI_STREAM_EVENT.PROPOSAL), proposal: aiProposalSchema }),
  aiProposalStatusEventSchema,
  z.object({ type: z.literal(AI_STREAM_EVENT.VIEW), toolCallId: z.string(), view: aiViewSchema }),
]);
export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>;

export const clinicSecretStatusSchema = z.object({
  set: z.boolean(),
  hint: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});
export type ClinicSecretStatus = z.infer<typeof clinicSecretStatusSchema>;

export const clinicSecretsSchema = z.object({
  encryptionAvailable: z.boolean(),
  secrets: z.record(z.enum(CLINIC_SECRET_KINDS), clinicSecretStatusSchema),
});
export type ClinicSecrets = z.infer<typeof clinicSecretsSchema>;

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
