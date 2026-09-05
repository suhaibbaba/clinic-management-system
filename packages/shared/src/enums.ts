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

/** Placeholder — filled in by the `appointments` module. */
export const APPOINTMENT_STATUS = {} as const satisfies Record<string, string>;
export type AppointmentStatus = EnumValue<typeof APPOINTMENT_STATUS>;

/** Placeholder — filled in by the `labs` module (draft → sent → ready → received → fitted). */
export const LAB_ORDER_STATUS = {} as const satisfies Record<string, string>;
export type LabOrderStatus = EnumValue<typeof LAB_ORDER_STATUS>;

/** Placeholder — filled in by the `inventory` module (purchase / consume / adjust). */
export const STOCK_MOVEMENT_TYPE = {} as const satisfies Record<string, string>;
export type StockMovementType = EnumValue<typeof STOCK_MOVEMENT_TYPE>;
