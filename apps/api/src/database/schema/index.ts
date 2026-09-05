/**
 * Drizzle table definitions.
 *
 * One file per domain module (`core.ts`, `patients.ts`, `billing.ts`, ...),
 * re-exported from here so `drizzle-kit` sees a single schema entry point.
 *
 * Reminders when the first tables land (CLAUDE.md):
 *  - every domain table carries `clinic_id`
 *  - `created_by` / `updated_by` / `created_at` / `updated_at` on every table
 *  - `deleted_at` for soft delete; medical and financial rows are never hard-deleted
 *  - money is `numeric(10, 2)` — never a float
 *  - balances and stock quantities are computed from append-only ledger tables,
 *    never stored as editable columns
 *
 * Intentionally empty: this is the skeleton, no domain module is scaffolded yet.
 */
export {};
