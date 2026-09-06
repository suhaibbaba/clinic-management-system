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
export type ToothState = EnumValue<typeof TOOTH_STATE>;

export const TOOTH_STATES = [
  TOOTH_STATE.HEALTHY,
  TOOTH_STATE.PLANNED,
  TOOTH_STATE.IN_PROGRESS,
  TOOTH_STATE.FILLING,
  TOOTH_STATE.ROOT_CANAL,
  TOOTH_STATE.CROWN,
  TOOTH_STATE.IMPLANT,
  TOOTH_STATE.BRIDGE,
  TOOTH_STATE.MISSING,
] as const;

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
export type ProcedureOutcome = EnumValue<typeof PROCEDURE_OUTCOME>;

export const PROCEDURE_OUTCOMES = [
  PROCEDURE_OUTCOME.FILLING,
  PROCEDURE_OUTCOME.ROOT_CANAL,
  PROCEDURE_OUTCOME.CROWN,
  PROCEDURE_OUTCOME.IMPLANT,
  PROCEDURE_OUTCOME.BRIDGE,
  PROCEDURE_OUTCOME.MISSING,
] as const;

/** Medical images and documents attached to a patient file. */
export const ATTACHMENT_TYPE = {
  XRAY_PANORAMIC: 'xray_panoramic',
  XRAY_PERIAPICAL: 'xray_periapical',
  XRAY_BITEWING: 'xray_bitewing',
  CBCT: 'cbct',
  CLINICAL_PHOTO: 'clinical_photo',
  DOCUMENT: 'document',
} as const satisfies Record<string, string>;
export type AttachmentType = EnumValue<typeof ATTACHMENT_TYPE>;

export const ATTACHMENT_TYPES = [
  ATTACHMENT_TYPE.XRAY_PANORAMIC,
  ATTACHMENT_TYPE.XRAY_PERIAPICAL,
  ATTACHMENT_TYPE.XRAY_BITEWING,
  ATTACHMENT_TYPE.CBCT,
  ATTACHMENT_TYPE.CLINICAL_PHOTO,
  ATTACHMENT_TYPE.DOCUMENT,
] as const;

/** How a payment reached the clinic. */
export const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer',
} as const satisfies Record<string, string>;
export type PaymentMethod = EnumValue<typeof PAYMENT_METHOD>;

export const PAYMENT_METHODS = [
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.TRANSFER,
] as const;

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
export type AppointmentType = EnumValue<typeof APPOINTMENT_TYPE>;

export const APPOINTMENT_TYPES = [
  APPOINTMENT_TYPE.CHECKUP,
  APPOINTMENT_TYPE.TREATMENT,
  APPOINTMENT_TYPE.FOLLOWUP,
  APPOINTMENT_TYPE.EMERGENCY,
] as const;

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

/** Placeholder — filled in by the `labs` module (draft → sent → ready → received → fitted). */
export const LAB_ORDER_STATUS = {} as const satisfies Record<string, string>;
export type LabOrderStatus = EnumValue<typeof LAB_ORDER_STATUS>;

/** Placeholder — filled in by the `inventory` module (purchase / consume / adjust). */
export const STOCK_MOVEMENT_TYPE = {} as const satisfies Record<string, string>;
export type StockMovementType = EnumValue<typeof STOCK_MOVEMENT_TYPE>;
