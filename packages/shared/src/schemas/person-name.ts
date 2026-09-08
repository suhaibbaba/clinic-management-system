import { z } from 'zod';

/**
 * A name a clinic writes down in both languages.
 *
 * Staff names and the clinic's own name, and nothing else. The interface is
 * Arabic and the printed documents may be either, so a single column meant
 * "Dr. Layla Haddad" sitting in the middle of an otherwise Arabic calendar
 * column — and no way at all to put the Arabic spelling anywhere.
 *
 * **Patient names are deliberately not this shape.** A patient's name is
 * whatever reception copied off their ID card, entered once, in whichever
 * script it was written in. Asking a receptionist to transliterate it at the
 * desk would invent data rather than record it, and a patient file is a legal
 * document that should say what the ID says. Staff are a closed, small set
 * that the clinic itself employs and can spell both ways once.
 *
 * Carried on the wire as an object rather than as two sibling fields
 * (`nameAr`, `nameEn`) so that a name is one value everywhere: it can be
 * passed to `<PersonName>`, sorted, or handed to `personName()` without every
 * call site knowing which two keys to pick up.
 */
export const personNameSchema = z.object({
  ar: z.string(),
  en: z.string(),
});
export type PersonName = z.infer<typeof personNameSchema>;

/**
 * What a form accepts. Both are required for staff — a half-filled bilingual
 * name is the state that produces the mixed-script screens this replaced.
 */
export const personNameInputSchema = z.object({
  ar: z.string().trim().min(2).max(120),
  en: z.string().trim().min(2).max(120),
});
export type PersonNameInput = z.infer<typeof personNameInputSchema>;

/**
 * The spelling to show a reader of `language`, falling back to the other.
 *
 * The fallback is not politeness, it is the migration: every name in an
 * existing database was copied into both columns, and a clinic that has since
 * filled in only the Arabic must not get a blank calendar in English. An empty
 * string is treated as absent for the same reason.
 *
 * `language` is an i18next tag — `ar`, `en`, `en-GB` — so it is matched by
 * prefix rather than compared.
 */
export function personName(name: PersonName | null | undefined, language: string): string {
  if (!name) {
    return '';
  }

  const english = language.startsWith('en');
  // Read defensively rather than destructured: this runs on the public booking
  // page, which a patient opens from a link, and a response from a stale cache
  // or an older API is not worth a white screen over. An unusable value reads
  // as a missing name, which the callers already handle.
  const ar = typeof name.ar === 'string' ? name.ar : '';
  const en = typeof name.en === 'string' ? name.en : '';

  const preferred = english ? en : ar;

  return preferred.trim() !== '' ? preferred : english ? ar : en;
}

/** Both spellings, for a search index or a `title` attribute. */
export const bothNames = (name: PersonName): string =>
  name.ar === name.en ? name.ar : `${name.ar} — ${name.en}`;
