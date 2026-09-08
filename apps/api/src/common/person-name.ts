import { personName, type PersonName } from '@clinic/shared';

/**
 * The two name columns, as the one value the wire carries.
 *
 * Staff names live in `name_ar` / `name_en` and travel as `{ ar, en }`, so a
 * select that denormalises a doctor's name onto a calendar block or a lab
 * sheet picks up both columns and folds them here. One function rather than an
 * object literal at each of the eight call sites, so a name that is null —
 * the waiting list allows "any doctor" — is handled the same way everywhere
 * instead of being a slightly different ternary each time.
 */
export function toPersonName(ar: string, en: string): PersonName {
  return { ar, en };
}

/** The same, for a left join that may have matched nothing. */
export function toOptionalPersonName(ar: string | null, en: string | null): PersonName | null {
  return ar === null || en === null ? null : { ar, en };
}

/**
 * A name inside a message sent to a patient.
 *
 * Always the Arabic spelling, with the English as the fallback: a WhatsApp
 * text is not a screen with a language toggle on it, and the patients this
 * system writes to read Arabic — the public booking page ships Arabic alone
 * for the same reason.
 */
export const notificationName = (name: PersonName): string => personName(name, 'ar');
