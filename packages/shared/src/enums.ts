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

/** Placeholder — filled in by the `appointments` module. */
export const APPOINTMENT_STATUS = {} as const satisfies Record<string, string>;
export type AppointmentStatus = EnumValue<typeof APPOINTMENT_STATUS>;

/** Placeholder — filled in by the `labs` module (draft → sent → ready → received → fitted). */
export const LAB_ORDER_STATUS = {} as const satisfies Record<string, string>;
export type LabOrderStatus = EnumValue<typeof LAB_ORDER_STATUS>;

/** Placeholder — filled in by the `inventory` module (purchase / consume / adjust). */
export const STOCK_MOVEMENT_TYPE = {} as const satisfies Record<string, string>;
export type StockMovementType = EnumValue<typeof STOCK_MOVEMENT_TYPE>;
