/**
 * Shared string enums.
 *
 * CLAUDE.md ("state machines as data"): statuses are string enums declared here
 * and reused by the API, the database and the web app. Allowed transitions are
 * validated in the API services, never in a controller or a schema.
 *
 * Pattern for every enum:
 *
 * ```ts
 * export const LAB_ORDER_STATUS = { DRAFT: 'draft', SENT: 'sent' } as const;
 * export type LabOrderStatus = EnumValue<typeof LAB_ORDER_STATUS>;
 * ```
 */

/** Value union of a `{ KEY: 'value' } as const` enum object. */
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

/**
 * Which interactive chart a specialty uses. Specialty-specific behaviour is
 * configuration, never a code branch (CLAUDE.md architecture decision 1).
 */
export const CHART_TYPE = {
  /** Teeth, FDI numbering (11–48, deciduous 51–85). */
  TOOTH_FDI: 'tooth_fdi',
  /** Skeleton / body region chart. */
  BODY_REGION: 'body_region',
  /** Specialty needs no chart. */
  NONE: 'none',
} as const satisfies Record<string, string>;
export type ChartType = EnumValue<typeof CHART_TYPE>;

export const CHART_TYPES = [CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION, CHART_TYPE.NONE] as const;

/**
 * Known specialty codes. Stored as text rather than a Postgres enum so a clinic
 * can be given a new specialty without a migration — this list is the set the
 * UI knows how to render a chart for.
 */
export const SPECIALTY_CODE = {
  DENTAL: 'dental',
  ORTHOPEDIC: 'orthopedic',
} as const satisfies Record<string, string>;
export type SpecialtyCode = EnumValue<typeof SPECIALTY_CODE>;

/** Mutation kinds recorded in the immutable audit log. */
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

/** Patient sex as recorded on the file. */
export const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
} as const satisfies Record<string, string>;
export type Gender = EnumValue<typeof GENDER>;

export const GENDERS = [GENDER.MALE, GENDER.FEMALE] as const;

/** Lifecycle of a treatment plan. */
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

/**
 * A plan item is `converted` exactly once, when it becomes a performed
 * procedure. Transitions are validated in the service (CLAUDE.md decision 7).
 */
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

/**
 * What an interactive chart shows for one location — a tooth in a dental
 * chart, and the same idea for whatever a future specialty charts.
 *
 * A location's state is *derived*, never stored: it comes from the performed
 * procedures recorded against it (see `PROCEDURE_OUTCOME` below), so it cannot
 * drift out of step with the record the way a stored status would.
 */
/**
 * The tooth states the **chart itself** knows how to draw.
 *
 * These are codes, not the list: the live list is `lookup_options` under
 * `tooth_state`, which a clinic edits (CLAUDE.md — a user-facing choice list is
 * always data). What stays here is the handful the drawing code names directly
 * — an implant has a post, a missing tooth is an outline — plus the codes the
 * seed writes. A state a clinic adds paints the whole tooth in its own colour
 * and needs no entry here.
 */
export const TOOTH_STATE = {
  /** Nothing recorded. */
  HEALTHY: 'healthy',
  /** Caries or any procedure planned but not started. */
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  FILLING: 'filling',
  ROOT_CANAL: 'root_canal',
  CROWN: 'crown',
  IMPLANT: 'implant',
  BRIDGE: 'bridge',
  MISSING: 'missing',
} as const satisfies Record<string, string>;
/**
 * A `tooth_state` lookup code. Open by design: the built-in ones are above,
 * and a clinic may add its own.
 */
export type ToothState = string;

/**
 * What a *completed* procedure leaves behind on the chart, classified per
 * catalog item rather than guessed from its name.
 *
 * This is configuration, not a code branch (CLAUDE.md architecture decision 1):
 * a clinic that adds "veneer" to its catalog picks the outcome it charts as,
 * and no client has to learn a new procedure name. A catalog item with no
 * outcome — an examination, a cleaning, an X-ray — leaves the tooth as it was.
 */
export const PROCEDURE_OUTCOME = {
  FILLING: TOOTH_STATE.FILLING,
  ROOT_CANAL: TOOTH_STATE.ROOT_CANAL,
  CROWN: TOOTH_STATE.CROWN,
  IMPLANT: TOOTH_STATE.IMPLANT,
  BRIDGE: TOOTH_STATE.BRIDGE,
  /** Extractions: the tooth is gone. */
  MISSING: TOOTH_STATE.MISSING,
} as const satisfies Record<string, ToothState>;
/** Any `tooth_state` code — including one this clinic invented. */
export type ProcedureOutcome = ToothState;

/** Medical images and documents attached to a patient file. */
export const ATTACHMENT_TYPE = {
  XRAY_PANORAMIC: 'xray_panoramic',
  XRAY_PERIAPICAL: 'xray_periapical',
  XRAY_BITEWING: 'xray_bitewing',
  CBCT: 'cbct',
  CLINICAL_PHOTO: 'clinical_photo',
  DOCUMENT: 'document',
} as const satisfies Record<string, string>;
/** An `attachment_type` lookup code. */
export type AttachmentType = string;

/** How a payment reached the clinic. */
export const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer',
} as const satisfies Record<string, string>;
/** A `payment_method` lookup code. */
export type PaymentMethod = string;

/**
 * What a ledger line is.
 *
 * The ledger is append-only: a mistake is corrected with a reversing entry
 * carrying the opposite amount, never by editing the original
 * (CLAUDE.md architecture decision 2).
 */
export const LEDGER_ENTRY_KIND = {
  CHARGE: 'charge',
  PAYMENT: 'payment',
} as const satisfies Record<string, string>;
export type LedgerEntryKind = EnumValue<typeof LEDGER_ENTRY_KIND>;

export const LEDGER_ENTRY_KINDS = [LEDGER_ENTRY_KIND.CHARGE, LEDGER_ENTRY_KIND.PAYMENT] as const;

/** Kinds of entry the merged patient timeline can contain. */
export const TIMELINE_ENTRY_TYPE = {
  VISIT: 'visit',
  PROCEDURE: 'procedure',
  ATTACHMENT: 'attachment',
  PRESCRIPTION: 'prescription',
  TREATMENT_PLAN: 'treatment_plan',
  /** Reserved for the appointments module. */
  APPOINTMENT: 'appointment',
  /** Reserved for the billing module. */
  PAYMENT: 'payment',
  CHARGE: 'charge',
  /** Work sent to a lab for this patient — a crown, a denture, a guard. */
  LAB_ORDER: 'lab_order',
  /** Stock used on this patient — an anaesthetic ampoule, a filling capsule. */
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

/**
 * Why the patient is coming. Drives nothing but the label and the default
 * duration a clinic may configure later — it is not a permission or a price.
 */
export const APPOINTMENT_TYPE = {
  CHECKUP: 'checkup',
  TREATMENT: 'treatment',
  FOLLOWUP: 'followup',
  EMERGENCY: 'emergency',
} as const satisfies Record<string, string>;
/** An `appointment_type` lookup code — the *status* beside it stays an enum. */
export type AppointmentType = string;

/**
 * Where an appointment is in its life.
 *
 * `requested` exists for the public booking module: a slot a patient picked
 * themselves is not a commitment until reception or an OTP confirms it. An
 * appointment reception books directly starts at `confirmed`.
 */
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

/**
 * The state machine, as data (CLAUDE.md architecture decision 7).
 *
 * Read it as "from → the states it may become". The services validate against
 * this table and nothing else, so the rules are reviewable in one place rather
 * than spread across seven endpoints.
 *
 * Two rules are worth stating out loud because they are the ones a UI would
 * otherwise quietly break:
 *
 *  - **`completed` is only reachable from `arrived` or `in_progress`.** A
 *    completed appointment is a claim that the patient was seen; allowing it
 *    straight from `confirmed` would let a no-show be marked done.
 *  - **The terminal states are terminal.** Completed, cancelled and no-show
 *    have no way out. Correcting one is a new appointment, not an edit, which
 *    is the same reasoning the ledgers use for a reversing entry.
 */
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

/**
 * Statuses that still occupy the doctor's time.
 *
 * A cancelled or missed appointment frees its slot — which is why the database
 * exclusion constraint and the availability computation both exclude exactly
 * these two, and why they are listed here once rather than twice.
 */
export const APPOINTMENT_RELEASED_STATUSES = [
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
] as const;

export const occupiesSlot = (status: AppointmentStatus): boolean =>
  !(APPOINTMENT_RELEASED_STATUSES as readonly AppointmentStatus[]).includes(status);

/**
 * How urgent a walk-in is. Ordered, and stored as text rather than a number so
 * the list can be read without a legend.
 */
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

/** Placeholder — filled in by the `inventory` module (purchase / consume / adjust). */
export const STOCK_MOVEMENT_TYPE = {} as const satisfies Record<string, string>;
export type StockMovementType = EnumValue<typeof STOCK_MOVEMENT_TYPE>;

/**
 * How a message reaches a patient.
 *
 * Both are "a short text to a phone number", which is why one abstraction
 * covers them: the difference is the transport, and the transport is a
 * provider's problem rather than a caller's.
 */
export const NOTIFICATION_CHANNEL = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
} as const satisfies Record<string, string>;
export type NotificationChannel = EnumValue<typeof NOTIFICATION_CHANNEL>;

export const NOTIFICATION_CHANNELS = [
  NOTIFICATION_CHANNEL.WHATSAPP,
  NOTIFICATION_CHANNEL.SMS,
] as const;

/**
 * Every message the clinic sends, by name.
 *
 * A closed list rather than free text: the template is what a clinic edits, so
 * a typo in a key would silently send nothing, and the reminder scheduler
 * dedupes on exactly this value.
 */
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

/**
 * What happened to one message.
 *
 * `queued` is the state a row is written in before the provider is called, so
 * a provider that throws still leaves a trace — a send that vanishes is the
 * one failure mode a notification log exists to prevent.
 */
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

/**
 * How a booking a patient made themselves becomes a real appointment.
 *
 * `otp` confirms it with a code sent to the phone that made it; `manual`
 * leaves it `requested` for reception to ring back. Both exist because a
 * clinic without an SMS gateway still wants online booking.
 */
export const BOOKING_CONFIRMATION_MODE = {
  OTP: 'otp',
  MANUAL: 'manual',
} as const satisfies Record<string, string>;
export type BookingConfirmationMode = EnumValue<typeof BOOKING_CONFIRMATION_MODE>;

export const BOOKING_CONFIRMATION_MODES = [
  BOOKING_CONFIRMATION_MODE.OTP,
  BOOKING_CONFIRMATION_MODE.MANUAL,
] as const;

/**
 * Where a piece of lab work has got to.
 *
 * The happy path is a straight line — drafted, sent to the lab, made, come
 * back, fitted in the patient's mouth — and the two ways off it are the two
 * things that actually go wrong: work that comes back wrong goes `returned`
 * and then out again, and an order nobody has sent yet can simply be
 * `cancelled`.
 */
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

/**
 * The whole state machine, in one table (CLAUDE.md architecture decision 7).
 *
 * `returned` is reachable from every state in which the clinic physically has
 * the work or is waiting for it — ready, received, fitted — because a crown
 * that does not seat is discovered at any of those moments, and it goes back
 * to `sent` when the lab takes it away again. `cancelled` is only reachable
 * before the work exists: once a lab has started, the clinic owes for it, and
 * the way out is a return, not a cancellation.
 */
export const LAB_ORDER_STATUS_TRANSITIONS = {
  [LAB_ORDER_STATUS.DRAFT]: [LAB_ORDER_STATUS.SENT, LAB_ORDER_STATUS.CANCELLED],
  [LAB_ORDER_STATUS.SENT]: [LAB_ORDER_STATUS.READY, LAB_ORDER_STATUS.CANCELLED],
  [LAB_ORDER_STATUS.READY]: [LAB_ORDER_STATUS.RECEIVED, LAB_ORDER_STATUS.RETURNED],
  [LAB_ORDER_STATUS.RECEIVED]: [LAB_ORDER_STATUS.FITTED, LAB_ORDER_STATUS.RETURNED],
  [LAB_ORDER_STATUS.FITTED]: [LAB_ORDER_STATUS.RETURNED],
  /** Back out to the lab, which is the only reason the state exists. */
  [LAB_ORDER_STATUS.RETURNED]: [LAB_ORDER_STATUS.SENT],
  [LAB_ORDER_STATUS.CANCELLED]: [],
} as const satisfies Record<LabOrderStatus, readonly LabOrderStatus[]>;

/** Whether one status may become another. The only test the service runs. */
export function canTransitionLabOrder(from: LabOrderStatus, to: LabOrderStatus): boolean {
  return (LAB_ORDER_STATUS_TRANSITIONS[from] as readonly LabOrderStatus[]).includes(to);
}

/**
 * Whether an order is money the clinic owes the lab.
 *
 * **An order counts from the moment it is sent, and stops counting only if it
 * is cancelled.** That is the whole rule, and it is here rather than in a SQL
 * string so the balance, the statement and the screens cannot disagree.
 *
 * The consequences are deliberate. A `draft` is a note to self and costs
 * nothing. A `returned` crown keeps counting: the lab did the work, the clinic
 * still owes for it, and remaking it is the lab's problem — if the two agree
 * otherwise, the correction is a credit line, not a disappearing charge.
 * `cancelled` is only reachable before the work exists (see the transition
 * table), which is exactly why it is the one status that can take an order out
 * of the balance without an entry to explain it.
 */
export const LAB_ORDER_BILLABLE_STATUSES = [
  LAB_ORDER_STATUS.SENT,
  LAB_ORDER_STATUS.READY,
  LAB_ORDER_STATUS.RECEIVED,
  LAB_ORDER_STATUS.FITTED,
  LAB_ORDER_STATUS.RETURNED,
] as const;

export const countsTowardLabBalance = (status: LabOrderStatus): boolean =>
  (LAB_ORDER_BILLABLE_STATUSES as readonly LabOrderStatus[]).includes(status);

/**
 * Statuses in which the clinic is still waiting for the lab.
 *
 * What "overdue" is measured against: an order past its expected date that has
 * not come back yet. Once it is received nobody is waiting, however late it
 * was.
 */
export const LAB_ORDER_AWAITING_STATUSES = [LAB_ORDER_STATUS.SENT, LAB_ORDER_STATUS.READY] as const;

export const awaitingLab = (status: LabOrderStatus): boolean =>
  (LAB_ORDER_AWAITING_STATUSES as readonly LabOrderStatus[]).includes(status);

/**
 * What kind of thing an item is.
 *
 * Four categories rather than a free-text field, because each one behaves
 * differently in the alerts a clinic actually acts on: a medication has an
 * expiry that matters clinically, a consumable runs out, a tool is counted and
 * sterilised rather than consumed. Deliberately not dental-specific — a
 * clinic of any specialty buys gloves and anaesthetic (CLAUDE.md: no
 * dental-only logic outside the dental configuration).
 */
export const ITEM_CATEGORY = {
  MEDICATION: 'medication',
  CONSUMABLE: 'consumable',
  TOOL: 'tool',
  STERILIZATION: 'sterilization',
} as const satisfies Record<string, string>;
/** An `item_category` lookup code. */
export type ItemCategory = string;

/**
 * How an item is counted.
 *
 * The unit is a label on a number, never a conversion: a box is not six
 * pieces here, because the clinic that buys a box of 100 gloves and the one
 * that buys a box of 50 would both be wrong. An item is counted in exactly one
 * unit for its whole life, which is what makes `sum(quantity)` meaningful.
 */
export const ITEM_UNIT = {
  PIECE: 'piece',
  BOX: 'box',
  PACK: 'pack',
  ML: 'ml',
  G: 'g',
  AMPOULE: 'ampoule',
} as const satisfies Record<string, string>;
/**
 * An `item_unit` lookup code.
 *
 * Still fixed for an item's life — every movement is a number *in* this unit —
 * but which units exist is the clinic's business.
 */
export type ItemUnit = string;

/**
 * Why the quantity moved.
 *
 * The sign is not free: a purchase adds, a consumption subtracts, and only an
 * adjustment may go either way — which is why an adjustment is the one type
 * that must say why. The type is therefore not decoration on a signed number;
 * it is what the number is allowed to be, and the service enforces the pairing.
 */
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
