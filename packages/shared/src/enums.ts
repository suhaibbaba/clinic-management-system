export type EnumValue<TEnum extends Record<string, string>> = TEnum[keyof TEnum];

/** Roles from ROLES.md. A user belongs to one clinic and has exactly one role (v1). */
export const USER_ROLE = {
  ADMIN: "admin",
  DOCTOR: "doctor",
  /** An external doctor who treats in the clinic; sees only the patients assigned to them. */
  VISITING_DOCTOR: "visiting_doctor",
  TECHNICIAN: "technician",
  RECEPTIONIST: "receptionist",
} as const satisfies Record<string, string>;
export type UserRole = EnumValue<typeof USER_ROLE>;

/** Declared as a const tuple so both `z.enum` and Drizzle's `pgEnum` accept it. */
export const USER_ROLES = [
  USER_ROLE.ADMIN,
  USER_ROLE.DOCTOR,
  USER_ROLE.VISITING_DOCTOR,
  USER_ROLE.TECHNICIAN,
  USER_ROLE.RECEPTIONIST,
] as const;

export const CHART_TYPE = {
  TOOTH_FDI: "tooth_fdi",
  BODY_REGION: "body_region",
  NONE: "none",
} as const satisfies Record<string, string>;
export type ChartType = EnumValue<typeof CHART_TYPE>;

export const CHART_TYPES = [CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION, CHART_TYPE.NONE] as const;

/** Text rather than a Postgres enum, so a clinic gets a new specialty without a migration. */
export const SPECIALTY_CODE = {
  DENTAL: "dental",
  ORTHOPEDIC: "orthopedic",
} as const satisfies Record<string, string>;
export type SpecialtyCode = EnumValue<typeof SPECIALTY_CODE>;

export const AUDIT_ACTION = {
  CREATE: "create",
  UPDATE: "update",
  /** Soft delete — nothing is ever hard-deleted (CLAUDE.md). */
  DELETE: "delete",
} as const satisfies Record<string, string>;
export type AuditAction = EnumValue<typeof AUDIT_ACTION>;

export const AUDIT_ACTIONS = [
  AUDIT_ACTION.CREATE,
  AUDIT_ACTION.UPDATE,
  AUDIT_ACTION.DELETE,
] as const;

export const GENDER = {
  MALE: "male",
  FEMALE: "female",
} as const satisfies Record<string, string>;
export type Gender = EnumValue<typeof GENDER>;

export const GENDERS = [GENDER.MALE, GENDER.FEMALE] as const;

export const TREATMENT_PLAN_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const satisfies Record<string, string>;
export type TreatmentPlanStatus = EnumValue<typeof TREATMENT_PLAN_STATUS>;

export const TREATMENT_PLAN_STATUSES = [
  TREATMENT_PLAN_STATUS.DRAFT,
  TREATMENT_PLAN_STATUS.ACTIVE,
  TREATMENT_PLAN_STATUS.COMPLETED,
  TREATMENT_PLAN_STATUS.CANCELLED,
] as const;

export const TREATMENT_PLAN_ITEM_STATUS = {
  PLANNED: "planned",
  CONVERTED: "converted",
  CANCELLED: "cancelled",
} as const satisfies Record<string, string>;
export type TreatmentPlanItemStatus = EnumValue<typeof TREATMENT_PLAN_ITEM_STATUS>;

export const TREATMENT_PLAN_ITEM_STATUSES = [
  TREATMENT_PLAN_ITEM_STATUS.PLANNED,
  TREATMENT_PLAN_ITEM_STATUS.CONVERTED,
  TREATMENT_PLAN_ITEM_STATUS.CANCELLED,
] as const;

export const PERFORMED_PROCEDURE_STATUS = {
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  DONE: "done",
} as const satisfies Record<string, string>;
export type PerformedProcedureStatus = EnumValue<typeof PERFORMED_PROCEDURE_STATUS>;

export const PERFORMED_PROCEDURE_STATUSES = [
  PERFORMED_PROCEDURE_STATUS.PLANNED,
  PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
  PERFORMED_PROCEDURE_STATUS.DONE,
] as const;

// The tooth states the chart's drawing code names directly, plus the codes the seed writes; a
// clinic may add more. A location's state is derived from its performed procedures, never stored.
export const TOOTH_STATE = {
  HEALTHY: "healthy",
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  FILLING: "filling",
  ROOT_CANAL: "root_canal",
  CROWN: "crown",
  IMPLANT: "implant",
  BRIDGE: "bridge",
  MISSING: "missing",
} as const satisfies Record<string, string>;
export type ToothState = string;

export const PROCEDURE_OUTCOME = {
  FILLING: TOOTH_STATE.FILLING,
  ROOT_CANAL: TOOTH_STATE.ROOT_CANAL,
  CROWN: TOOTH_STATE.CROWN,
  IMPLANT: TOOTH_STATE.IMPLANT,
  BRIDGE: TOOTH_STATE.BRIDGE,
  MISSING: TOOTH_STATE.MISSING,
} as const satisfies Record<string, ToothState>;
/** Any `tooth_state` code — including one this clinic invented. */
export type ProcedureOutcome = ToothState;

export const ATTACHMENT_TYPE = {
  XRAY_PANORAMIC: "xray_panoramic",
  XRAY_PERIAPICAL: "xray_periapical",
  XRAY_BITEWING: "xray_bitewing",
  CBCT: "cbct",
  CLINICAL_PHOTO: "clinical_photo",
  DOCUMENT: "document",
} as const satisfies Record<string, string>;
export type AttachmentType = string;

export const PAYMENT_METHOD = {
  CASH: "cash",
  CARD: "card",
  TRANSFER: "transfer",
} as const satisfies Record<string, string>;
export type PaymentMethod = string;

/** Append-only: a mistake is corrected with a reversing entry, never by editing the original. */
export const LEDGER_ENTRY_KIND = {
  CHARGE: "charge",
  PAYMENT: "payment",
} as const satisfies Record<string, string>;
export type LedgerEntryKind = EnumValue<typeof LEDGER_ENTRY_KIND>;

export const LEDGER_ENTRY_KINDS = [LEDGER_ENTRY_KIND.CHARGE, LEDGER_ENTRY_KIND.PAYMENT] as const;

export const TIMELINE_ENTRY_TYPE = {
  VISIT: "visit",
  PROCEDURE: "procedure",
  ATTACHMENT: "attachment",
  PRESCRIPTION: "prescription",
  TREATMENT_PLAN: "treatment_plan",
  APPOINTMENT: "appointment",
  PAYMENT: "payment",
  CHARGE: "charge",
  LAB_ORDER: "lab_order",
  SUPPLY: "supply",
} as const satisfies Record<string, string>;
export type TimelineEntryType = EnumValue<typeof TIMELINE_ENTRY_TYPE>;

export const TIMELINE_ENTRY_TYPES = [
  TIMELINE_ENTRY_TYPE.VISIT,
  TIMELINE_ENTRY_TYPE.PROCEDURE,
  TIMELINE_ENTRY_TYPE.ATTACHMENT,
  TIMELINE_ENTRY_TYPE.PRESCRIPTION,
  TIMELINE_ENTRY_TYPE.TREATMENT_PLAN,
  TIMELINE_ENTRY_TYPE.APPOINTMENT,
  TIMELINE_ENTRY_TYPE.PAYMENT,
  TIMELINE_ENTRY_TYPE.CHARGE,
  TIMELINE_ENTRY_TYPE.LAB_ORDER,
  TIMELINE_ENTRY_TYPE.SUPPLY,
] as const;

export const APPOINTMENT_TYPE = {
  CHECKUP: "checkup",
  TREATMENT: "treatment",
  FOLLOWUP: "followup",
  EMERGENCY: "emergency",
} as const satisfies Record<string, string>;
/** An `appointment_type` lookup code — the *status* beside it stays an enum. */
export type AppointmentType = string;

// `requested` is public booking's: a slot the patient picked is not a commitment until reception or
// an OTP confirms it.
export const APPOINTMENT_STATUS = {
  REQUESTED: "requested",
  CONFIRMED: "confirmed",
  ARRIVED: "arrived",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
  CANCELLED: "cancelled",
} as const satisfies Record<string, string>;
export type AppointmentStatus = EnumValue<typeof APPOINTMENT_STATUS>;

export const APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS.REQUESTED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.ARRIVED,
  APPOINTMENT_STATUS.IN_PROGRESS,
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.CANCELLED,
] as const;

// `completed` is reachable only from `arrived`/`in_progress`, so a no-show cannot be marked done.
// Terminal states are terminal: correcting one is a new appointment, not an edit.
export const APPOINTMENT_STATUS_TRANSITIONS = {
  [APPOINTMENT_STATUS.REQUESTED]: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.CONFIRMED]: [
    APPOINTMENT_STATUS.ARRIVED,
    APPOINTMENT_STATUS.NO_SHOW,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.ARRIVED]: [
    APPOINTMENT_STATUS.IN_PROGRESS,
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.NO_SHOW,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.IN_PROGRESS]: [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.COMPLETED]: [],
  [APPOINTMENT_STATUS.NO_SHOW]: [],
  [APPOINTMENT_STATUS.CANCELLED]: [],
} as const satisfies Record<AppointmentStatus, readonly AppointmentStatus[]>;

/** Whether one status may become another. The only test any service runs. */
export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return (APPOINTMENT_STATUS_TRANSITIONS[from] as readonly AppointmentStatus[]).includes(to);
}

export const APPOINTMENT_RELEASED_STATUSES = [
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
] as const;

export const occupiesSlot = (status: AppointmentStatus): boolean =>
  !(APPOINTMENT_RELEASED_STATUSES as readonly AppointmentStatus[]).includes(status);

export const WAITING_LIST_PRIORITY = {
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
} as const satisfies Record<string, string>;
export type WaitingListPriority = EnumValue<typeof WAITING_LIST_PRIORITY>;

export const WAITING_LIST_PRIORITIES = [
  WAITING_LIST_PRIORITY.NORMAL,
  WAITING_LIST_PRIORITY.HIGH,
  WAITING_LIST_PRIORITY.URGENT,
] as const;

/** Most urgent first — the order the panel and the scheduling picker use. */
export const WAITING_LIST_PRIORITY_RANK: Record<WaitingListPriority, number> = {
  [WAITING_LIST_PRIORITY.URGENT]: 0,
  [WAITING_LIST_PRIORITY.HIGH]: 1,
  [WAITING_LIST_PRIORITY.NORMAL]: 2,
};

export const WAITING_LIST_SOURCE = {
  RECEPTION: "reception",
  ONLINE: "online",
} as const satisfies Record<string, string>;
export type WaitingListSource = EnumValue<typeof WAITING_LIST_SOURCE>;

export const WAITING_LIST_SOURCES = [
  WAITING_LIST_SOURCE.RECEPTION,
  WAITING_LIST_SOURCE.ONLINE,
] as const;

// A state machine, so an enum rather than a lookup list (CLAUDE.md decision 8): the transitions,
// the permissions and what each one notifies are written against these exact values.
export const WAITING_LIST_STATUS = {
  PENDING: "pending",
  CONTACTED: "contacted",
  SCHEDULED: "scheduled",
  DECLINED: "declined",
} as const satisfies Record<string, string>;
export type WaitingListStatus = EnumValue<typeof WAITING_LIST_STATUS>;

export const WAITING_LIST_STATUSES = [
  WAITING_LIST_STATUS.PENDING,
  WAITING_LIST_STATUS.CONTACTED,
  WAITING_LIST_STATUS.SCHEDULED,
  WAITING_LIST_STATUS.DECLINED,
] as const;

/** Ringing back is optional; both ways out are terminal. */
export const WAITING_LIST_STATUS_TRANSITIONS = {
  [WAITING_LIST_STATUS.PENDING]: [
    WAITING_LIST_STATUS.CONTACTED,
    WAITING_LIST_STATUS.SCHEDULED,
    WAITING_LIST_STATUS.DECLINED,
  ],
  [WAITING_LIST_STATUS.CONTACTED]: [WAITING_LIST_STATUS.SCHEDULED, WAITING_LIST_STATUS.DECLINED],
  [WAITING_LIST_STATUS.SCHEDULED]: [],
  [WAITING_LIST_STATUS.DECLINED]: [],
} as const satisfies Record<WaitingListStatus, readonly WaitingListStatus[]>;

export function canTransitionWaitingListEntry(
  from: WaitingListStatus,
  to: WaitingListStatus,
): boolean {
  return (WAITING_LIST_STATUS_TRANSITIONS[from] as readonly WaitingListStatus[]).includes(to);
}

export const STOCK_MOVEMENT_TYPE = {} as const satisfies Record<string, string>;
export type StockMovementType = EnumValue<typeof STOCK_MOVEMENT_TYPE>;

export const NOTIFICATION_CHANNEL = {
  WHATSAPP: "whatsapp",
  SMS: "sms",
} as const satisfies Record<string, string>;
export type NotificationChannel = EnumValue<typeof NOTIFICATION_CHANNEL>;

export const NOTIFICATION_CHANNELS = [
  NOTIFICATION_CHANNEL.WHATSAPP,
  NOTIFICATION_CHANNEL.SMS,
] as const;

export const NOTIFICATION_TEMPLATE = {
  BOOKING_OTP: "booking_otp",
  BOOKING_CONFIRMED: "booking_confirmed",
  REMINDER_24H: "reminder_24h",
  REMINDER_2H: "reminder_2h",
  BOOKING_CANCELLED: "booking_cancelled",
  URGENT_RECEIVED: "urgent_received",
  URGENT_SCHEDULED: "urgent_scheduled",
  URGENT_DECLINED: "urgent_declined",
  ASSISTANT_MESSAGE: "assistant_message",
} as const satisfies Record<string, string>;
export type NotificationTemplate = EnumValue<typeof NOTIFICATION_TEMPLATE>;

export const NOTIFICATION_TEMPLATES = [
  NOTIFICATION_TEMPLATE.BOOKING_OTP,
  NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED,
  NOTIFICATION_TEMPLATE.REMINDER_24H,
  NOTIFICATION_TEMPLATE.REMINDER_2H,
  NOTIFICATION_TEMPLATE.BOOKING_CANCELLED,
  NOTIFICATION_TEMPLATE.URGENT_RECEIVED,
  NOTIFICATION_TEMPLATE.URGENT_SCHEDULED,
  NOTIFICATION_TEMPLATE.URGENT_DECLINED,
  NOTIFICATION_TEMPLATE.ASSISTANT_MESSAGE,
] as const;

// `queued` is written before the provider is called, so a provider that throws still leaves a
// trace.
export const NOTIFICATION_STATUS = {
  QUEUED: "queued",
  SENT: "sent",
  FAILED: "failed",
} as const satisfies Record<string, string>;
export type NotificationStatus = EnumValue<typeof NOTIFICATION_STATUS>;

export const NOTIFICATION_STATUSES = [
  NOTIFICATION_STATUS.QUEUED,
  NOTIFICATION_STATUS.SENT,
  NOTIFICATION_STATUS.FAILED,
] as const;

// `manual` leaves the booking `requested` for reception to ring back — a clinic without an SMS
// gateway still gets online booking.
export const BOOKING_CONFIRMATION_MODE = {
  OTP: "otp",
  MANUAL: "manual",
} as const satisfies Record<string, string>;
export type BookingConfirmationMode = EnumValue<typeof BOOKING_CONFIRMATION_MODE>;

export const BOOKING_CONFIRMATION_MODES = [
  BOOKING_CONFIRMATION_MODE.OTP,
  BOOKING_CONFIRMATION_MODE.MANUAL,
] as const;

export const LAB_ORDER_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  READY: "ready",
  RECEIVED: "received",
  FITTED: "fitted",
  RETURNED: "returned",
  CANCELLED: "cancelled",
} as const satisfies Record<string, string>;
export type LabOrderStatus = EnumValue<typeof LAB_ORDER_STATUS>;

export const LAB_ORDER_STATUSES = [
  LAB_ORDER_STATUS.DRAFT,
  LAB_ORDER_STATUS.SENT,
  LAB_ORDER_STATUS.READY,
  LAB_ORDER_STATUS.RECEIVED,
  LAB_ORDER_STATUS.FITTED,
  LAB_ORDER_STATUS.RETURNED,
  LAB_ORDER_STATUS.CANCELLED,
] as const;

// `returned` is reachable wherever the work exists (ready/received/fitted) and goes back to `sent`;
// `cancelled` only before the lab starts, since after that the clinic owes for it.
export const LAB_ORDER_STATUS_TRANSITIONS = {
  [LAB_ORDER_STATUS.DRAFT]: [LAB_ORDER_STATUS.SENT, LAB_ORDER_STATUS.CANCELLED],
  [LAB_ORDER_STATUS.SENT]: [LAB_ORDER_STATUS.READY, LAB_ORDER_STATUS.CANCELLED],
  [LAB_ORDER_STATUS.READY]: [LAB_ORDER_STATUS.RECEIVED, LAB_ORDER_STATUS.RETURNED],
  [LAB_ORDER_STATUS.RECEIVED]: [LAB_ORDER_STATUS.FITTED, LAB_ORDER_STATUS.RETURNED],
  [LAB_ORDER_STATUS.FITTED]: [LAB_ORDER_STATUS.RETURNED],
  [LAB_ORDER_STATUS.RETURNED]: [LAB_ORDER_STATUS.SENT],
  [LAB_ORDER_STATUS.CANCELLED]: [],
} as const satisfies Record<LabOrderStatus, readonly LabOrderStatus[]>;

/** Whether one status may become another. The only test the service runs. */
export function canTransitionLabOrder(from: LabOrderStatus, to: LabOrderStatus): boolean {
  return (LAB_ORDER_STATUS_TRANSITIONS[from] as readonly LabOrderStatus[]).includes(to);
}

// Owed from `sent`, stops counting only if `cancelled` — one rule, not a SQL string per screen. A
// `returned` crown still counts; a lab that agrees otherwise gets a credit line.
export const LAB_ORDER_BILLABLE_STATUSES = [
  LAB_ORDER_STATUS.SENT,
  LAB_ORDER_STATUS.READY,
  LAB_ORDER_STATUS.RECEIVED,
  LAB_ORDER_STATUS.FITTED,
  LAB_ORDER_STATUS.RETURNED,
] as const;

export const countsTowardLabBalance = (status: LabOrderStatus): boolean =>
  (LAB_ORDER_BILLABLE_STATUSES as readonly LabOrderStatus[]).includes(status);

/** What "overdue" is measured against — past its expected date and not back yet. */
export const LAB_ORDER_AWAITING_STATUSES = [LAB_ORDER_STATUS.SENT, LAB_ORDER_STATUS.READY] as const;

export const awaitingLab = (status: LabOrderStatus): boolean =>
  (LAB_ORDER_AWAITING_STATUSES as readonly LabOrderStatus[]).includes(status);

export const ITEM_CATEGORY = {
  MEDICATION: "medication",
  CONSUMABLE: "consumable",
  TOOL: "tool",
  STERILIZATION: "sterilization",
} as const satisfies Record<string, string>;
export type ItemCategory = string;

// The unit is a label on a number, never a conversion — an item keeps one unit for life, which is
// what makes sum(quantity) meaningful.
export const ITEM_UNIT = {
  PIECE: "piece",
  BOX: "box",
  PACK: "pack",
  ML: "ml",
  G: "g",
  AMPOULE: "ampoule",
} as const satisfies Record<string, string>;
export type ItemUnit = string;

export const MOVEMENT_TYPE = {
  PURCHASE: "purchase",
  CONSUME: "consume",
  ADJUST: "adjust",
} as const satisfies Record<string, string>;
export type MovementType = EnumValue<typeof MOVEMENT_TYPE>;

export const MOVEMENT_TYPES = [
  MOVEMENT_TYPE.PURCHASE,
  MOVEMENT_TYPE.CONSUME,
  MOVEMENT_TYPE.ADJUST,
] as const;

/** Which way a movement of this type may point. `null` is "either way". */
export const MOVEMENT_SIGN: Record<MovementType, 1 | -1 | null> = {
  [MOVEMENT_TYPE.PURCHASE]: 1,
  [MOVEMENT_TYPE.CONSUME]: -1,
  [MOVEMENT_TYPE.ADJUST]: null,
};

// The assistant's own vocabulary: what a stored message was. A state machine rather than a lookup
// list — the agent loop is written against these exact values (CLAUDE.md decision 8).
export const AI_MESSAGE_ROLE = {
  USER: "user",
  ASSISTANT: "assistant",
  TOOL: "tool",
} as const satisfies Record<string, string>;
export type AiMessageRole = EnumValue<typeof AI_MESSAGE_ROLE>;

export const AI_MESSAGE_ROLES = [
  AI_MESSAGE_ROLE.USER,
  AI_MESSAGE_ROLE.ASSISTANT,
  AI_MESSAGE_ROLE.TOOL,
] as const;

// Every tool the model may call. A name the model invents is refused before anything runs, and the
// web resolves each to its Arabic progress line by code.
export const AI_TOOL = {
  GET_APPOINTMENTS: "get_appointments",
  SEARCH_PATIENTS: "search_patients",
  GET_PATIENT_SUMMARY: "get_patient_summary",
  GET_DAILY_STATS: "get_daily_stats",
  GET_FINANCIAL_SUMMARY: "get_financial_summary",
  GET_OVERDUE_LAB_ORDERS: "get_overdue_lab_orders",
  GET_LOW_STOCK_ITEMS: "get_low_stock_items",
  QUERY_DATA: "query_data",
  LOAD_TOOLS: "load_tools",
  DRAFT_BULK_MESSAGE: "draft_bulk_message",
  SET_APPOINTMENT_STATUS: "set_appointment_status",
  ADD_PATIENT_NOTE: "add_patient_note",
  CREATE_APPOINTMENT: "create_appointment",
  RESCHEDULE_APPOINTMENT: "reschedule_appointment",
  CANCEL_APPOINTMENTS: "cancel_appointments",
  CREATE_PATIENT: "create_patient",
  RECORD_PAYMENT: "record_payment",
  FIND_DOCTORS: "find_doctors",
  ADD_DOCTOR_TIME_OFF: "add_doctor_time_off",
  ADD_CLINIC_CLOSURE: "add_clinic_closure",
  UPDATE_DOCTOR_TIME_OFF: "update_doctor_time_off",
  DELETE_DOCTOR_TIME_OFF: "delete_doctor_time_off",
  SET_LAB_ORDER_STATUS: "set_lab_order_status",
  RECORD_STOCK_MOVEMENT: "record_stock_movement",
  SET_DOCTOR_SCHEDULE: "set_doctor_schedule",
  REVERSE_PAYMENT: "reverse_payment",
  RECORD_LAB_PAYMENT: "record_lab_payment",
  REVERSE_LAB_PAYMENT: "reverse_lab_payment",
  REVERSE_STOCK_MOVEMENT: "reverse_stock_movement",
  FIND_AVAILABLE_SLOTS: "find_available_slots",
  ADD_DOCTOR_EXTRA_HOURS: "add_doctor_extra_hours",
  PROPOSE_PLAN: "propose_plan",
} as const satisfies Record<string, string>;
export type AiToolName = EnumValue<typeof AI_TOOL>;

export const AI_TOOL_NAMES = [
  AI_TOOL.GET_APPOINTMENTS,
  AI_TOOL.SEARCH_PATIENTS,
  AI_TOOL.GET_PATIENT_SUMMARY,
  AI_TOOL.GET_DAILY_STATS,
  AI_TOOL.GET_FINANCIAL_SUMMARY,
  AI_TOOL.GET_OVERDUE_LAB_ORDERS,
  AI_TOOL.GET_LOW_STOCK_ITEMS,
  AI_TOOL.QUERY_DATA,
  AI_TOOL.LOAD_TOOLS,
  AI_TOOL.DRAFT_BULK_MESSAGE,
  AI_TOOL.SET_APPOINTMENT_STATUS,
  AI_TOOL.ADD_PATIENT_NOTE,
  AI_TOOL.CREATE_APPOINTMENT,
  AI_TOOL.RESCHEDULE_APPOINTMENT,
  AI_TOOL.CANCEL_APPOINTMENTS,
  AI_TOOL.CREATE_PATIENT,
  AI_TOOL.RECORD_PAYMENT,
  AI_TOOL.FIND_DOCTORS,
  AI_TOOL.ADD_DOCTOR_TIME_OFF,
  AI_TOOL.ADD_CLINIC_CLOSURE,
  AI_TOOL.UPDATE_DOCTOR_TIME_OFF,
  AI_TOOL.DELETE_DOCTOR_TIME_OFF,
  AI_TOOL.SET_LAB_ORDER_STATUS,
  AI_TOOL.RECORD_STOCK_MOVEMENT,
  AI_TOOL.SET_DOCTOR_SCHEDULE,
  AI_TOOL.REVERSE_PAYMENT,
  AI_TOOL.RECORD_LAB_PAYMENT,
  AI_TOOL.REVERSE_LAB_PAYMENT,
  AI_TOOL.REVERSE_STOCK_MOVEMENT,
  AI_TOOL.FIND_AVAILABLE_SLOTS,
  AI_TOOL.ADD_DOCTOR_EXTRA_HOURS,
  AI_TOOL.PROPOSE_PLAN,
] as const;

/** The tools that change something. Each one a clinic may switch off or tighten. */
export const AI_ACTION_TOOLS = [
  AI_TOOL.SET_APPOINTMENT_STATUS,
  AI_TOOL.ADD_PATIENT_NOTE,
  AI_TOOL.CREATE_APPOINTMENT,
  AI_TOOL.RESCHEDULE_APPOINTMENT,
  AI_TOOL.CANCEL_APPOINTMENTS,
  AI_TOOL.CREATE_PATIENT,
  AI_TOOL.RECORD_PAYMENT,
  AI_TOOL.ADD_DOCTOR_TIME_OFF,
  AI_TOOL.ADD_CLINIC_CLOSURE,
  AI_TOOL.UPDATE_DOCTOR_TIME_OFF,
  AI_TOOL.DELETE_DOCTOR_TIME_OFF,
  AI_TOOL.SET_LAB_ORDER_STATUS,
  AI_TOOL.RECORD_STOCK_MOVEMENT,
  AI_TOOL.SET_DOCTOR_SCHEDULE,
  AI_TOOL.REVERSE_PAYMENT,
  AI_TOOL.RECORD_LAB_PAYMENT,
  AI_TOOL.REVERSE_LAB_PAYMENT,
  AI_TOOL.REVERSE_STOCK_MOVEMENT,
  AI_TOOL.ADD_DOCTOR_EXTRA_HOURS,
  AI_TOOL.PROPOSE_PLAN,
] as const;
export type AiActionTool = (typeof AI_ACTION_TOOLS)[number];

// How much a person must do before an action runs. Ordered: a tier is only ever raised, by the
// clinic or by what the call turned out to touch, never lowered.
export const AI_RISK_TIER = {
  AUTO: "auto",
  CONFIRM: "confirm",
  TYPED: "typed",
} as const satisfies Record<string, string>;
export type AiRiskTier = EnumValue<typeof AI_RISK_TIER>;

export const AI_RISK_TIERS = [AI_RISK_TIER.AUTO, AI_RISK_TIER.CONFIRM, AI_RISK_TIER.TYPED] as const;

/** The stricter of two tiers. */
export const maxRiskTier = (...tiers: readonly AiRiskTier[]): AiRiskTier =>
  tiers.reduce<AiRiskTier>(
    (strictest, tier) =>
      AI_RISK_TIERS.indexOf(tier) > AI_RISK_TIERS.indexOf(strictest) ? tier : strictest,
    AI_RISK_TIER.AUTO,
  );

/**
 * The tier the code gives each action — the floor a clinic's settings can only raise, and what the
 * API runs against. A call can raise it further (`cancel_appointments` of several, a large payment).
 */
export const AI_ACTION_BASE_TIER: Record<AiActionTool, AiRiskTier> = {
  [AI_TOOL.SET_APPOINTMENT_STATUS]: AI_RISK_TIER.AUTO,
  [AI_TOOL.ADD_PATIENT_NOTE]: AI_RISK_TIER.AUTO,
  [AI_TOOL.CREATE_APPOINTMENT]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.RESCHEDULE_APPOINTMENT]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.CANCEL_APPOINTMENTS]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.CREATE_PATIENT]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.RECORD_PAYMENT]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.ADD_DOCTOR_TIME_OFF]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.ADD_CLINIC_CLOSURE]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.UPDATE_DOCTOR_TIME_OFF]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.DELETE_DOCTOR_TIME_OFF]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.SET_LAB_ORDER_STATUS]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.RECORD_STOCK_MOVEMENT]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.SET_DOCTOR_SCHEDULE]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.RECORD_LAB_PAYMENT]: AI_RISK_TIER.CONFIRM,
  [AI_TOOL.ADD_DOCTOR_EXTRA_HOURS]: AI_RISK_TIER.CONFIRM,
  // Several changes at once never run without somebody reading them.
  [AI_TOOL.PROPOSE_PLAN]: AI_RISK_TIER.CONFIRM,
  // A reversal makes money or stock appear to come back, and only an admin may: always typed.
  [AI_TOOL.REVERSE_PAYMENT]: AI_RISK_TIER.TYPED,
  [AI_TOOL.REVERSE_LAB_PAYMENT]: AI_RISK_TIER.TYPED,
  [AI_TOOL.REVERSE_STOCK_MOVEMENT]: AI_RISK_TIER.TYPED,
};

/** What a pending proposal will do once a person confirms it. */
export const AI_PROPOSAL_KIND = {
  MESSAGE: "message",
  APPOINTMENT_CREATE: "appointment_create",
  APPOINTMENT_UPDATE: "appointment_update",
  APPOINTMENT_STATUS: "appointment_status",
  APPOINTMENT_CANCEL: "appointment_cancel",
  PATIENT_CREATE: "patient_create",
  PATIENT_NOTE: "patient_note",
  PAYMENT_CREATE: "payment_create",
  TIME_OFF_CREATE: "time_off_create",
  CLOSURE_CREATE: "closure_create",
  TIME_OFF_UPDATE: "time_off_update",
  TIME_OFF_DELETE: "time_off_delete",
  LAB_ORDER_STATUS: "lab_order_status",
  STOCK_MOVEMENT: "stock_movement",
  DOCTOR_SCHEDULE: "doctor_schedule",
  PAYMENT_REVERSE: "payment_reverse",
  LAB_PAYMENT_CREATE: "lab_payment_create",
  LAB_PAYMENT_REVERSE: "lab_payment_reverse",
  STOCK_REVERSE: "stock_reverse",
  EXTRA_HOURS_CREATE: "extra_hours_create",
  PLAN: "plan",
  /** A write generated from a route: its tool name travels in the payload. */
  ROUTE_CALL: "route_call",
} as const satisfies Record<string, string>;
export type AiProposalKind = EnumValue<typeof AI_PROPOSAL_KIND>;

export const AI_PROPOSAL_KINDS = [
  AI_PROPOSAL_KIND.MESSAGE,
  AI_PROPOSAL_KIND.APPOINTMENT_CREATE,
  AI_PROPOSAL_KIND.APPOINTMENT_UPDATE,
  AI_PROPOSAL_KIND.APPOINTMENT_STATUS,
  AI_PROPOSAL_KIND.APPOINTMENT_CANCEL,
  AI_PROPOSAL_KIND.PATIENT_CREATE,
  AI_PROPOSAL_KIND.PATIENT_NOTE,
  AI_PROPOSAL_KIND.PAYMENT_CREATE,
  AI_PROPOSAL_KIND.TIME_OFF_CREATE,
  AI_PROPOSAL_KIND.CLOSURE_CREATE,
  AI_PROPOSAL_KIND.TIME_OFF_UPDATE,
  AI_PROPOSAL_KIND.TIME_OFF_DELETE,
  AI_PROPOSAL_KIND.LAB_ORDER_STATUS,
  AI_PROPOSAL_KIND.STOCK_MOVEMENT,
  AI_PROPOSAL_KIND.DOCTOR_SCHEDULE,
  AI_PROPOSAL_KIND.PAYMENT_REVERSE,
  AI_PROPOSAL_KIND.LAB_PAYMENT_CREATE,
  AI_PROPOSAL_KIND.LAB_PAYMENT_REVERSE,
  AI_PROPOSAL_KIND.STOCK_REVERSE,
  AI_PROPOSAL_KIND.EXTRA_HOURS_CREATE,
  AI_PROPOSAL_KIND.PLAN,
  AI_PROPOSAL_KIND.ROUTE_CALL,
] as const;

// Not errors: the model relays each one as a question and does not retry around it. Only a
// sanity check can be acknowledged, and only after the user answered it.
export const AI_ACTION_CHECK = {
  LARGE_CANCELLATION: "large_cancellation",
  EXCEEDS_BALANCE: "exceeds_balance",
  DORMANT_PATIENT: "dormant_patient",
  /** A new patient on a phone another patient already has — a parent and child share a handset. */
  POSSIBLE_DUPLICATE: "possible_duplicate",
  /** A new weekly schedule that leaves booked appointments outside its hours. */
  OUTSIDE_SCHEDULE: "outside_schedule",
} as const satisfies Record<string, string>;
export type AiActionCheck = EnumValue<typeof AI_ACTION_CHECK>;

/** What the user chose for the appointments inside a period they are closing. */
export const AI_SCHEDULE_CONFLICT_CHOICE = {
  CANCEL: "cancel_appointments",
  KEEP: "keep_appointments",
} as const satisfies Record<string, string>;
export type AiScheduleConflictChoice = EnumValue<typeof AI_SCHEDULE_CONFLICT_CHOICE>;

export const AI_SCHEDULE_CONFLICT_CHOICES = [
  AI_SCHEDULE_CONFLICT_CHOICE.CANCEL,
  AI_SCHEDULE_CONFLICT_CHOICE.KEEP,
] as const;

export const AI_ACTION_CHECKS = [
  AI_ACTION_CHECK.LARGE_CANCELLATION,
  AI_ACTION_CHECK.EXCEEDS_BALANCE,
  AI_ACTION_CHECK.DORMANT_PATIENT,
  AI_ACTION_CHECK.POSSIBLE_DUPLICATE,
  AI_ACTION_CHECK.OUTSIDE_SCHEDULE,
] as const;

export const AI_STREAM_EVENT = {
  /** First frame: which conversation this turn belongs to, so a new one gets an id immediately. */
  CONVERSATION: "conversation",
  TOOL: "tool",
  DELTA: "delta",
  DONE: "done",
  ERROR: "error",
  /** A drafted bulk message awaiting the user's confirmation card. */
  PROPOSAL: "proposal",
  /** A proposal moved: the send and cancel endpoints answer with this frame too. */
  PROPOSAL_STATUS: "proposal_status",
  /** A tool's result drawn as a table or card, which the model never sees. */
  VIEW: "view",
} as const satisfies Record<string, string>;
export type AiStreamEventType = EnumValue<typeof AI_STREAM_EVENT>;

export const AI_STREAM_EVENTS = [
  AI_STREAM_EVENT.CONVERSATION,
  AI_STREAM_EVENT.TOOL,
  AI_STREAM_EVENT.DELTA,
  AI_STREAM_EVENT.DONE,
  AI_STREAM_EVENT.ERROR,
  AI_STREAM_EVENT.PROPOSAL,
  AI_STREAM_EVENT.PROPOSAL_STATUS,
  AI_STREAM_EVENT.VIEW,
] as const;

// Codes, never sentences: the stream carries one of these and the web writes the Arabic. The last
// two are the page's own: a stream that closed without a terminal frame, and no network at all.
export const AI_ERROR_CODE = {
  RATE_LIMITED: "rate_limited",
  BUDGET_EXHAUSTED: "budget_exhausted",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  /** The provider refused the key (401/403): an admin has to fix it, a retry will not. */
  PROVIDER_REJECTED: "provider_rejected",
  PROVIDER_QUOTA: "provider_quota",
  STEP_LIMIT: "step_limit",
  FAILED: "failed",
  CONNECTION_LOST: "connection_lost",
  OFFLINE: "offline",
} as const satisfies Record<string, string>;
export type AiErrorCode = EnumValue<typeof AI_ERROR_CODE>;

export const AI_ERROR_CODES = [
  AI_ERROR_CODE.RATE_LIMITED,
  AI_ERROR_CODE.BUDGET_EXHAUSTED,
  AI_ERROR_CODE.PROVIDER_UNAVAILABLE,
  AI_ERROR_CODE.PROVIDER_REJECTED,
  AI_ERROR_CODE.PROVIDER_QUOTA,
  AI_ERROR_CODE.STEP_LIMIT,
  AI_ERROR_CODE.FAILED,
  AI_ERROR_CODE.CONNECTION_LOST,
  AI_ERROR_CODE.OFFLINE,
] as const;

// What a tool answers with when it will not run. The model reads these as data and explains itself
// to the user; none of them carries an internal detail.
export const AI_TOOL_ERROR = {
  INVALID_ARGUMENTS: "invalid_arguments",
  NOT_PERMITTED: "not_permitted",
  NOT_FOUND: "not_found",
  FAILED: "failed",
  /** The clinic switched this tool off in its assistant settings. */
  DISABLED: "disabled",
  // query_data: each refusal its own code, so the model knows what to change.
  QUERY_UNPARSEABLE: "query_unparseable",
  QUERY_MULTIPLE_STATEMENTS: "query_multiple_statements",
  QUERY_NOT_SELECT: "query_not_select",
  QUERY_RELATION_NOT_ALLOWED: "query_relation_not_allowed",
  QUERY_FUNCTION_NOT_ALLOWED: "query_function_not_allowed",
  QUERY_CLINICAL_NOT_PERMITTED: "query_clinical_not_permitted",
  QUERY_TIMEOUT: "query_timeout",
  /** Postgres rejected it — a column that does not exist, a type mismatch. */
  QUERY_ERROR: "query_error",
  /** A tool of a group this turn has not loaded: load_tools first. */
  NOT_LOADED: "tool_not_loaded",
} as const satisfies Record<string, string>;
export type AiToolError = EnumValue<typeof AI_TOOL_ERROR>;

// `sending` is the claim that stops a second click from sending (or running) twice; `expired` is
// written when somebody acts on a draft past its time, and served for one that is merely past it.
// A message ends `sent`; an action ends `done`, or `failed` with the domain's refusal.
export const AI_PROPOSAL_STATUS = {
  DRAFT: "draft",
  SENDING: "sending",
  SENT: "sent",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  DONE: "done",
  FAILED: "failed",
} as const satisfies Record<string, string>;
export type AiProposalStatus = EnumValue<typeof AI_PROPOSAL_STATUS>;

export const AI_PROPOSAL_STATUSES = [
  AI_PROPOSAL_STATUS.DRAFT,
  AI_PROPOSAL_STATUS.SENDING,
  AI_PROPOSAL_STATUS.SENT,
  AI_PROPOSAL_STATUS.CANCELLED,
  AI_PROPOSAL_STATUS.EXPIRED,
  AI_PROPOSAL_STATUS.DONE,
  AI_PROPOSAL_STATUS.FAILED,
] as const;

export const AI_PROPOSAL_STATUS_TRANSITIONS = {
  [AI_PROPOSAL_STATUS.DRAFT]: [
    AI_PROPOSAL_STATUS.SENDING,
    AI_PROPOSAL_STATUS.CANCELLED,
    AI_PROPOSAL_STATUS.EXPIRED,
  ],
  [AI_PROPOSAL_STATUS.SENDING]: [
    AI_PROPOSAL_STATUS.SENT,
    AI_PROPOSAL_STATUS.DONE,
    AI_PROPOSAL_STATUS.FAILED,
  ],
  [AI_PROPOSAL_STATUS.SENT]: [],
  [AI_PROPOSAL_STATUS.CANCELLED]: [],
  [AI_PROPOSAL_STATUS.EXPIRED]: [],
  [AI_PROPOSAL_STATUS.DONE]: [],
  [AI_PROPOSAL_STATUS.FAILED]: [],
} as const satisfies Record<AiProposalStatus, readonly AiProposalStatus[]>;

export function canTransitionAiProposal(from: AiProposalStatus, to: AiProposalStatus): boolean {
  return (AI_PROPOSAL_STATUS_TRANSITIONS[from] as readonly AiProposalStatus[]).includes(to);
}

/** Who a bulk message goes to. The first three are also the daily automation rules. */
export const AI_OUTBOUND_TARGET = {
  OVERDUE_LABS: "overdue_labs",
  UNPAID_INVOICES: "unpaid_invoices",
  TOMORROW_APPOINTMENTS: "tomorrow_appointments",
  PATIENT_IDS: "patient_ids",
} as const satisfies Record<string, string>;
export type AiOutboundTarget = EnumValue<typeof AI_OUTBOUND_TARGET>;

export const AI_OUTBOUND_TARGETS = [
  AI_OUTBOUND_TARGET.OVERDUE_LABS,
  AI_OUTBOUND_TARGET.UNPAID_INVOICES,
  AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS,
  AI_OUTBOUND_TARGET.PATIENT_IDS,
] as const;

export const AI_AUTOMATION_RULES = [
  AI_OUTBOUND_TARGET.OVERDUE_LABS,
  AI_OUTBOUND_TARGET.UNPAID_INVOICES,
  AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS,
] as const;
export type AiAutomationRule = (typeof AI_AUTOMATION_RULES)[number];

export const AI_AUTOMATION_MODE = {
  OFF: "off",
  PROPOSE: "propose",
  AUTO_SEND: "auto_send",
} as const satisfies Record<string, string>;
export type AiAutomationMode = EnumValue<typeof AI_AUTOMATION_MODE>;

export const AI_AUTOMATION_MODES = [
  AI_AUTOMATION_MODE.OFF,
  AI_AUTOMATION_MODE.PROPOSE,
  AI_AUTOMATION_MODE.AUTO_SEND,
] as const;

export const AI_OUTBOUND_TRIGGER = {
  COMMAND: "command",
  CRON: "cron",
} as const satisfies Record<string, string>;
export type AiOutboundTrigger = EnumValue<typeof AI_OUTBOUND_TRIGGER>;

export const AI_OUTBOUND_TRIGGERS = [
  AI_OUTBOUND_TRIGGER.COMMAND,
  AI_OUTBOUND_TRIGGER.CRON,
] as const;

export const AI_AUTOMATION_RUN_STATUS = {
  RUNNING: "running",
  DONE: "done",
  FAILED: "failed",
} as const satisfies Record<string, string>;
export type AiAutomationRunStatus = EnumValue<typeof AI_AUTOMATION_RUN_STATUS>;

export const AI_AUTOMATION_RUN_STATUSES = [
  AI_AUTOMATION_RUN_STATUS.RUNNING,
  AI_AUTOMATION_RUN_STATUS.DONE,
  AI_AUTOMATION_RUN_STATUS.FAILED,
] as const;

// Why a proposal was refused, as the `message` of the error the send endpoint answers with, and as
// the tool error the model reads when a draft cannot be made. The web writes the Arabic.
export const AI_OUTBOUND_ERROR = {
  EXPIRED: "proposal_expired",
  NOT_PENDING: "proposal_not_pending",
  RECIPIENT_CAP: "recipient_cap_exceeded",
  DAILY_CAP: "daily_cap_exceeded",
  NO_RECIPIENTS: "no_recipients",
  NOTIFICATIONS_DISABLED: "notifications_disabled",
} as const satisfies Record<string, string>;
export type AiOutboundError = EnumValue<typeof AI_OUTBOUND_ERROR>;

export const AI_OUTBOUND_ERRORS = [
  AI_OUTBOUND_ERROR.EXPIRED,
  AI_OUTBOUND_ERROR.NOT_PENDING,
  AI_OUTBOUND_ERROR.RECIPIENT_CAP,
  AI_OUTBOUND_ERROR.DAILY_CAP,
  AI_OUTBOUND_ERROR.NO_RECIPIENTS,
  AI_OUTBOUND_ERROR.NOTIFICATIONS_DISABLED,
] as const;

// Why an action did not run: refused at the click, or refused by the domain once it did. Codes the
// card writes the Arabic for; a domain error the card does not know reads as `action_failed`.
export const AI_ACTION_ERROR = {
  PHRASE_MISMATCH: "phrase_mismatch",
  NOT_PERMITTED: "action_not_permitted",
  DISABLED: "action_disabled",
  SLOT_TAKEN: "slot_taken",
  INVALID_TRANSITION: "invalid_transition",
  NOT_FOUND: "action_target_not_found",
  DUPLICATE: "possible_duplicate",
  /** Appointments booked into the period after the card was drafted. */
  SCHEDULE_CONFLICT: "schedule_conflict",
  /** A plan step re-checked before it ran no longer matches what the card showed. */
  CHANGED_SINCE_DRAFT: "changed_since_draft",
  /** A plan step still has a field the person must fill in on the card. */
  INPUT_REQUIRED: "input_required",
  FAILED: "action_failed",
} as const satisfies Record<string, string>;
export type AiActionError = EnumValue<typeof AI_ACTION_ERROR>;

export const AI_ACTION_ERRORS = [
  AI_ACTION_ERROR.PHRASE_MISMATCH,
  AI_ACTION_ERROR.NOT_PERMITTED,
  AI_ACTION_ERROR.DISABLED,
  AI_ACTION_ERROR.SLOT_TAKEN,
  AI_ACTION_ERROR.INVALID_TRANSITION,
  AI_ACTION_ERROR.NOT_FOUND,
  AI_ACTION_ERROR.DUPLICATE,
  AI_ACTION_ERROR.SCHEDULE_CONFLICT,
  AI_ACTION_ERROR.CHANGED_SINCE_DRAFT,
  AI_ACTION_ERROR.INPUT_REQUIRED,
  AI_ACTION_ERROR.FAILED,
] as const;

// A clinic's own provider credentials. Stored encrypted and never served back: a screen learns
// only whether one is set and how it ends.
export const CLINIC_SECRET_KIND = {
  OPENAI_API_KEY: "openai_api_key",
  WHATSAPP_ACCESS_TOKEN: "whatsapp_access_token",
  WHATSAPP_PHONE_NUMBER_ID: "whatsapp_phone_number_id",
  WHATSAPP_TEMPLATE_NAME: "whatsapp_template_name",
} as const satisfies Record<string, string>;
export type ClinicSecretKind = EnumValue<typeof CLINIC_SECRET_KIND>;

export const CLINIC_SECRET_KINDS = [
  CLINIC_SECRET_KIND.OPENAI_API_KEY,
  CLINIC_SECRET_KIND.WHATSAPP_ACCESS_TOKEN,
  CLINIC_SECRET_KIND.WHATSAPP_PHONE_NUMBER_ID,
  CLINIC_SECRET_KIND.WHATSAPP_TEMPLATE_NAME,
] as const;

export const CLINIC_SECRET_ERROR = {
  /** The server has no master key, so nothing can be stored encrypted. */
  UNAVAILABLE: "secrets_unavailable",
} as const satisfies Record<string, string>;
export type ClinicSecretError = EnumValue<typeof CLINIC_SECRET_ERROR>;

/** Why a procedure or a visit cannot be deleted; the page words it from the code. */
export const CLINICAL_DELETE_ERROR = {
  HAS_PAYMENTS: "has_payments",
} as const satisfies Record<string, string>;
export type ClinicalDeleteError = EnumValue<typeof CLINICAL_DELETE_ERROR>;

/** Why a stock movement was refused; the page words it from the code. */
export const STOCK_ERROR = {
  INSUFFICIENT: "insufficient_stock",
} as const satisfies Record<string, string>;
