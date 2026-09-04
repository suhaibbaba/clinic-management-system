/**
 * Shared status enums.
 *
 * CLAUDE.md ("state machines as data"): statuses are string enums declared here
 * and reused by the API, the database and the web app. Allowed transitions are
 * validated in the API services, never in a controller or a schema.
 *
 * These are intentionally EMPTY placeholders — the skeleton scaffolds no domain
 * module. Each domain module fills its own enum in when it is built, following
 * this pattern:
 *
 * ```ts
 * export const LAB_ORDER_STATUS = {
 *   DRAFT: 'draft',
 *   SENT: 'sent',
 * } as const;
 * export type LabOrderStatus = EnumValue<typeof LAB_ORDER_STATUS>;
 * ```
 */

/** Value union of a `{ KEY: 'value' } as const` enum object. */
export type EnumValue<TEnum extends Record<string, string>> = TEnum[keyof TEnum];

/** Placeholder — filled in by the `core` module (see ROLES.md). */
export const USER_ROLE = {} as const satisfies Record<string, string>;
export type UserRole = EnumValue<typeof USER_ROLE>;

/** Placeholder — filled in by the `appointments` module. */
export const APPOINTMENT_STATUS = {} as const satisfies Record<string, string>;
export type AppointmentStatus = EnumValue<typeof APPOINTMENT_STATUS>;

/** Placeholder — filled in by the `labs` module (draft → sent → ready → received → fitted). */
export const LAB_ORDER_STATUS = {} as const satisfies Record<string, string>;
export type LabOrderStatus = EnumValue<typeof LAB_ORDER_STATUS>;

/** Placeholder — filled in by the `inventory` module (purchase / consume / adjust). */
export const STOCK_MOVEMENT_TYPE = {} as const satisfies Record<string, string>;
export type StockMovementType = EnumValue<typeof STOCK_MOVEMENT_TYPE>;
