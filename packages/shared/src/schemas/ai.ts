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

// What a read tool hands the page beside the model's result: data, not prose, so a list of
// appointments is drawn as the same table every turn. Labels are i18n keys the page translates;
// money, dates and names are formatted on the page.
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
  /** An i18n key. */
  label: z.string(),
  kind: z.enum(AI_VIEW_COLUMN_KINDS),
  /** `code` only: the i18n prefix the value is looked up under. */
  prefix: z.string().optional(),
});
export type AiViewColumn = z.infer<typeof aiViewColumnSchema>;

/** A `link` cell. The address is one of the app's own screens. */
export const aiViewLinkSchema = z.object({ href: z.string().startsWith("/"), label: z.string() });
export type AiViewLink = z.infer<typeof aiViewLinkSchema>;

export const aiTableViewSchema = z.object({
  type: z.literal("table"),
  columns: z.array(aiViewColumnSchema),
  rows: z.array(z.record(z.string(), z.unknown())),
  truncated: z.boolean(),
  total: z.number().int().optional(),
  /** The screen showing the whole list, with the same filters in its address. */
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
      /** Masked. */
      phone: z.string(),
    }),
    /** Absent where the role may not read it. */
    balance: z.string().optional(),
    table: aiTableViewSchema,
  }),
  z.object({
    type: z.literal("list"),
    items: z.array(
      z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        /** A date the item is about, formatted on the page. */
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
  /** Set on a `tool` row only: which tool answered. */
  toolName: z.enum(AI_TOOL_NAMES).nullable(),
  /** Set on the row that drafted a proposal: the thread draws its confirmation card there. */
  proposalId: uuidSchema.nullable(),
  /** Set on a tool row whose result the thread draws as a table or card. */
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
  /** Exactly what the patient will receive. */
  text: z.string(),
});
export type AiProposalRecipient = z.infer<typeof aiProposalRecipientSchema>;

/**
 * What an action card shows, resolved on the server when the action was drafted: names and file
 * numbers for the ids the action carries. Ids, not names, are what runs.
 */
export const aiActionSummarySchema = z.object({
  patient: z.object({ id: uuidSchema, fullName: z.string(), fileNumber: z.string() }).optional(),
  doctor: z.object({ id: uuidSchema, name: personNameSchema }).optional(),
  /** A patient the action registers, as the user gave it — the card is where they check it. */
  newPatient: z
    .object({ fullName: z.string(), phone: z.string(), dateOfBirth: z.string().nullable() })
    .optional(),
  startsAt: z.iso.datetime().optional(),
  previousStartsAt: z.iso.datetime().optional(),
  /** The end of a time-off period, exclusive. */
  endsAt: z.iso.datetime().optional(),
  previousEndsAt: z.iso.datetime().optional(),
  /** A clinic closure's inclusive local days. */
  startsOn: z.iso.date().optional(),
  endsOn: z.iso.date().optional(),
  /** What happens to the appointments listed below: cancelled, or kept in the closed period. */
  onConflict: z.enum(AI_SCHEDULE_CONFLICT_CHOICES).optional(),
  durationMinutes: z.number().int().optional(),
  /** The status an appointment moves to. */
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  reason: z.string().optional(),
  note: z.string().optional(),
  amount: moneySchema.optional(),
  /** A payment method's lookup code. */
  method: z.string().optional(),
  labOrder: z
    .object({
      id: uuidSchema,
      labName: z.string(),
      workTypeName: z.string().nullable(),
      status: z.enum(LAB_ORDER_STATUSES),
    })
    .optional(),
  /** The status a lab order moves to. */
  labStatus: z.enum(LAB_ORDER_STATUSES).optional(),
  /** A stock item; `unit` is a code on the clinic's unit list. */
  stockItem: z.object({ id: uuidSchema, name: z.string(), unit: z.string() }).optional(),
  movementType: z.enum(MOVEMENT_TYPES).optional(),
  /** Signed for an adjustment, in the item's own unit. */
  quantity: z.string().optional(),
  lab: z.object({ id: uuidSchema, name: z.string() }).optional(),
  /** When the entry a reversal cancels was recorded. */
  recordedAt: z.iso.datetime().optional(),
  /** The weekdays a new weekly schedule changes, before and after. */
  scheduleChanges: z
    .array(
      z.object({
        weekday: weekdaySchema,
        before: z.array(timeRangeSchema),
        after: z.array(timeRangeSchema),
      }),
    )
    .optional(),
  /** The listed appointments stay booked outside the new hours. */
  outsideHours: z.boolean().optional(),
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
export type AiActionSummary = z.infer<typeof aiActionSummarySchema>;

export const AI_ACTION_ENTITIES = ["appointment", "patient", "payment"] as const;

/** The row an action created or changed, for the card's link to it. */
export const aiActionResultSchema = z.object({
  entity: z.enum(AI_ACTION_ENTITIES),
  id: uuidSchema,
  /** The patient the row belongs to, for a link into their file. */
  patientId: uuidSchema.nullable(),
});
export type AiActionResult = z.infer<typeof aiActionResultSchema>;

// No phone numbers: the card is for checking who and what, and the number is on the patient's file.
// A message carries its target and recipients; an action its tier and summary.
export const aiProposalSchema = z.object({
  id: uuidSchema,
  kind: z.enum(AI_PROPOSAL_KINDS),
  status: z.enum(AI_PROPOSAL_STATUSES),
  trigger: z.enum(AI_OUTBOUND_TRIGGERS),
  target: z.enum(AI_OUTBOUND_TARGETS).nullable(),
  intent: z.string().nullable(),
  conversationId: uuidSchema.nullable(),
  /** Null for a proposal the daily automation made. */
  createdBy: uuidSchema.nullable(),
  recipients: z.array(aiProposalRecipientSchema),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  sentAt: z.iso.datetime().nullable(),
  sentCount: z.number().int(),
  failedCount: z.number().int(),
  tier: z.enum(AI_RISK_TIERS).nullable(),
  /** Set on a `typed` action: exactly what the confirming person must type. */
  typedPhrase: z.string().nullable(),
  summary: aiActionSummarySchema.nullable(),
  result: aiActionResultSchema.nullable(),
  /** Why a `failed` action did not run. */
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

/** The confirmation card's button. A `typed` action carries what the person typed. */
export const confirmAiProposalSchema = z.object({
  typedPhrase: z.string().max(200).optional(),
});
export type ConfirmAiProposalInput = z.infer<typeof confirmAiProposalSchema>;

// A clinic may only tighten: switch a tool off, or raise its tier. Nothing here can lower the tier
// the code gives a tool, and the server takes the strictest of the three it knows.
export const aiActionsSettingsSchema = z.object({
  disabled: z.array(z.enum(AI_ACTION_TOOLS)).max(AI_ACTION_TOOLS.length).default([]),
  minTier: z.partialRecord(z.enum(AI_ACTION_TOOLS), z.enum(AI_RISK_TIERS)).default({}),
  /** A payment at or above this, in whole money, needs the typed phrase. */
  paymentTypedAbove: z.number().int().min(1).max(99_999_999).default(500),
  /** Cancelling more appointments than this at once needs the typed phrase. */
  cancelTypedAbove: z.number().int().min(0).max(50).default(1),
});
export type AiActionsSettings = z.infer<typeof aiActionsSettingsSchema>;

export const AI_ACTIONS_SETTINGS_KEY = "assistantActions";

/** Never throws: an unreadable setting falls back to the defaults, which are the code's own tiers. */
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
  result: aiActionResultSchema.nullable().optional(),
  error: z.enum(AI_ACTION_ERRORS).nullable().optional(),
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
  z.object({ type: z.literal(AI_STREAM_EVENT.VIEW), toolCallId: z.string(), view: aiViewSchema }),
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
