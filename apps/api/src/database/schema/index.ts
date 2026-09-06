/**
 * Drizzle table definitions — one file per domain module, re-exported here so
 * `drizzle-kit` sees a single schema entry point.
 *
 * Rules that apply to every table (CLAUDE.md):
 *  - every domain table carries `clinic_id`
 *  - `created_by` / `updated_by` / `created_at` / `updated_at` everywhere
 *  - `deleted_at` for soft delete; medical and financial rows are never hard-deleted
 *  - money is `numeric(10, 2)` — never a float
 *  - balances and stock quantities are computed from append-only ledger tables
 */
export * from '@api/database/schema/core';
export * from '@api/database/schema/patients';
export * from '@api/database/schema/billing';
export * from '@api/database/schema/appointments';
export * from '@api/database/schema/notifications';
