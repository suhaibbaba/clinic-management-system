/**
 * Money now lives in `components/ui` — it is used by inventory, labs, the
 * dashboard and the patients list as much as by billing, and a shared control
 * that lives inside one feature is a shared control other features import
 * across a boundary they should not.
 *
 * Re-exported here so the existing call sites keep working; new ones should
 * import from `@web/components/ui`.
 */
export { Money } from '@web/components/ui/money';
