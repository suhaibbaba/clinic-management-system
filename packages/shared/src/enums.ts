export type EnumValue<TEnum extends Record<string, string>> = TEnum[keyof TEnum];

/** Roles from ROLES.md. A user belongs to one clinic and has exactly one role (v1). */
export const USER_ROLE = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  TECHNICIAN: 'technician',
  RECEPTIONIST: 'receptionist',
} as const satisfies Record<string, string>;
export type UserRole = EnumValue<typeof USER_ROLE>;

/** Declared as a const tuple so both `z.enum` and Drizzle's `pgEnum` accept it. */
export const USER_ROLES = [
  USER_ROLE.ADMIN,
  USER_ROLE.DOCTOR,
  USER_ROLE.TECHNICIAN,
  USER_ROLE.RECEPTIONIST,
] as const;

export const CHART_TYPE = {
  TOOTH_FDI: 'tooth_fdi',
  BODY_REGION: 'body_region',
  NONE: 'none',
} as const satisfies Record<string, string>;
export type ChartType = EnumValue<typeof CHART_TYPE>;

export const CHART_TYPES = [CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION, CHART_TYPE.NONE] as const;

/** Text rather than a Postgres enum, so a clinic gets a new specialty without a migration. */
export const SPECIALTY_CODE = {
  DENTAL: 'dental',
  ORTHOPEDIC: 'orthopedic',
} as const satisfies Record<string, string>;
export type SpecialtyCode = EnumValue<typeof SPECIALTY_CODE>;

export const AUDIT_ACTION = {
  CREATE: 'create',
  UPDATE: 'update',
  /** Soft delete — nothing is ever hard-deleted (CLAUDE.md). */
  DELETE: 'delete',
} as const satisfies Record<string, string>;
export type AuditAction = EnumValue<typeof AUDIT_ACTION>;

export const AUDIT_ACTIONS = [
  AUDIT_ACTION.CREATE,
  AUDIT_ACTION.UPDATE,
  AUDIT_ACTION.DELETE,
] as const;

export const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
} as const satisfies Record<string, string>;
export type Gender = EnumValue<typeof GENDER>;

export const GENDERS = [GENDER.MALE, GENDER.FEMALE] as const;

export const TREATMENT_PLAN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const satisfies Record<string, string>;
export type TreatmentPlanStatus = EnumValue<typeof TREATMENT_PLAN_STATUS>;

export const TREATMENT_PLAN_STATUSES = [
  TREATMENT_PLAN_STATUS.DRAFT,
  TREATMENT_PLAN_STATUS.ACTIVE,
  TREATMENT_PLAN_STATUS.COMPLETED,
  TREATMENT_PLAN_STATUS.CANCELLED,
] as const;

export const TREATMENT_PLAN_ITEM_STATUS = {
  PLANNED: 'planned',
  CONVERTED: 'converted',
  CANCELLED: 'cancelled',
} as const satisfies Record<string, string>;
export type TreatmentPlanItemStatus = EnumValue<typeof TREATMENT_PLAN_ITEM_STATUS>;

export const TREATMENT_PLAN_ITEM_STATUSES = [
  TREATMENT_PLAN_ITEM_STATUS.PLANNED,
  TREATMENT_PLAN_ITEM_STATUS.CONVERTED,
  TREATMENT_PLAN_ITEM_STATUS.CANCELLED,
] as const;

export const PERFORMED_PROCEDURE_STATUS = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
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
  HEALTHY: 'healthy',
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  FILLING: 'filling',
  ROOT_CANAL: 'root_canal',
  CROWN: 'crown',
  IMPLANT: 'implant',
  BRIDGE: 'bridge',
  MISSING: 'missing',
} as const satisfies Record<string, string>;
export type ToothState = string;

// What a completed procedure leaves behind on the chart, set per catalog item rather than guessed
// from its name.
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
  XRAY_PANORAMIC: 'xray_panoramic',
  XRAY_PERIAPICAL: 'xray_periapical',
  XRAY_BITEWING: 'xray_bitewing',
  CBCT: 'cbct',
  CLINICAL_PHOTO: 'clinical_photo',
  DOCUMENT: 'document',
} as const satisfies Record<string, string>;
export type AttachmentType = string;

export const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer',
} as const satisfies Record<string, string>;
export type PaymentMethod = string;

/** Append-only: a mistake is corrected with a reversing entry, never by editing the original. */
export const LEDGER_ENTRY_KIND = {
  CHARGE: 'charge',
  PAYMENT: 'payment',
} as const satisfies Record<string, string>;
export type LedgerEntryKind = EnumValue<typeof LEDGER_ENTRY_KIND>;

export const LEDGER_ENTRY_KINDS = [LEDGER_ENTRY_KIND.CHARGE, LEDGER_ENTRY_KIND.PAYMENT] as const;

export const TIMELINE_ENTRY_TYPE = {
  VISIT: 'visit',
  PROCEDURE: 'procedure',
  ATTACHMENT: 'attachment',
  PRESCRIPTION: 'prescription',
  TREATMENT_PLAN: 'treatment_plan',
  APPOINTMENT: 'appointment',
  PAYMENT: 'payment',
  CHARGE: 'charge',
  LAB_ORDER: 'lab_order',
  SUPPLY: 'supply',
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
  CHECKUP: 'checkup',
  TREATMENT: 'treatment',
  FOLLOWUP: 'followup',
  EMERGENCY: 'emergency',
} as const satisfies Record<string, string>;
/** An `appointment_type` lookup code — the *status* beside it stays an enum. */
export type AppointmentType = string;

// `requested` is public booking's: a slot the patient picked is not a commitment until reception or
// an OTP confirms it.
export const APPOINTMENT_STATUS = {
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  ARRIVED: 'arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
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

// Cancelled and no-show free the slot — the DB exclusion constraint and the availability
// computation both exclude exactly these.
export const APPOINTMENT_RELEASED_STATUSES = [
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
] as const;

export const occupiesSlot = (status: AppointmentStatus): boolean =>
  !(APPOINTMENT_RELEASED_STATUSES as readonly AppointmentStatus[]).includes(status);

export const WAITING_LIST_PRIORITY = {
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const satisfies Record<string, string>;
export type WaitingListPriority = EnumValue<typeof WAITING_LIST_PRIORITY>;

export const WAITING_LIST_PRIORITIES = [
  WAITING_LIST_PRIORITY.NORMAL,
  WAITING_LIST_PRIORITY.HIGH,
  WAITING_LIST_PRIORITY.URGENT,
] as const;

/** Most urgent first — the order the panel and the promote picker use. */
export const WAITING_LIST_PRIORITY_RANK: Record<WaitingListPriority, number> = {
  [WAITING_LIST_PRIORITY.URGENT]: 0,
  [WAITING_LIST_PRIORITY.HIGH]: 1,
  [WAITING_LIST_PRIORITY.NORMAL]: 2,
};

export const STOCK_MOVEMENT_TYPE = {} as const satisfies Record<string, string>;
export type StockMovementType = EnumValue<typeof STOCK_MOVEMENT_TYPE>;

export const NOTIFICATION_CHANNEL = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
} as const satisfies Record<string, string>;
export type NotificationChannel = EnumValue<typeof NOTIFICATION_CHANNEL>;

export const NOTIFICATION_CHANNELS = [
  NOTIFICATION_CHANNEL.WHATSAPP,
  NOTIFICATION_CHANNEL.SMS,
] as const;

export const NOTIFICATION_TEMPLATE = {
  BOOKING_OTP: 'booking_otp',
  BOOKING_CONFIRMED: 'booking_confirmed',
  REMINDER_24H: 'reminder_24h',
  REMINDER_2H: 'reminder_2h',
  BOOKING_CANCELLED: 'booking_cancelled',
} as const satisfies Record<string, string>;
export type NotificationTemplate = EnumValue<typeof NOTIFICATION_TEMPLATE>;

export const NOTIFICATION_TEMPLATES = [
  NOTIFICATION_TEMPLATE.BOOKING_OTP,
  NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED,
  NOTIFICATION_TEMPLATE.REMINDER_24H,
  NOTIFICATION_TEMPLATE.REMINDER_2H,
  NOTIFICATION_TEMPLATE.BOOKING_CANCELLED,
] as const;

// `queued` is written before the provider is called, so a provider that throws still leaves a
// trace.
export const NOTIFICATION_STATUS = {
  QUEUED: 'queued',
  SENT: 'sent',
  FAILED: 'failed',
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
  OTP: 'otp',
  MANUAL: 'manual',
} as const satisfies Record<string, string>;
export type BookingConfirmationMode = EnumValue<typeof BOOKING_CONFIRMATION_MODE>;

export const BOOKING_CONFIRMATION_MODES = [
  BOOKING_CONFIRMATION_MODE.OTP,
  BOOKING_CONFIRMATION_MODE.MANUAL,
] as const;

export const LAB_ORDER_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  READY: 'ready',
  RECEIVED: 'received',
  FITTED: 'fitted',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
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
  MEDICATION: 'medication',
  CONSUMABLE: 'consumable',
  TOOL: 'tool',
  STERILIZATION: 'sterilization',
} as const satisfies Record<string, string>;
export type ItemCategory = string;

// The unit is a label on a number, never a conversion — an item keeps one unit for life, which is
// what makes sum(quantity) meaningful.
export const ITEM_UNIT = {
  PIECE: 'piece',
  BOX: 'box',
  PACK: 'pack',
  ML: 'ml',
  G: 'g',
  AMPOULE: 'ampoule',
} as const satisfies Record<string, string>;
export type ItemUnit = string;

// The sign is not free: purchase adds, consumption subtracts, only an adjustment may go either way
// — and must say why.
export const MOVEMENT_TYPE = {
  PURCHASE: 'purchase',
  CONSUME: 'consume',
  ADJUST: 'adjust',
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
