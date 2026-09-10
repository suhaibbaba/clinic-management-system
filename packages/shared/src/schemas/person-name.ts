import { z } from 'zod';

// Staff and clinic names only — a patient's is the one field reception copied off an ID card. One
// object on the wire, so `personName()` takes a single value.
export const personNameSchema = z.object({
  ar: z.string(),
  en: z.string(),
});
export type PersonName = z.infer<typeof personNameSchema>;

export const personNameInputSchema = z.object({
  ar: z.string().trim().min(2).max(120),
  en: z.string().trim().min(2).max(120),
});
export type PersonNameInput = z.infer<typeof personNameInputSchema>;

// The fallback is the migration: names were copied into both columns, and a clinic that since
// filled only Arabic must not get a blank English calendar. `language` matches by prefix.
export function personName(name: PersonName | null | undefined, language: string): string {
  if (!name) {
    return '';
  }

  const english = language.startsWith('en');
  // Read defensively: this runs on the public booking page, where a stale cache or an older API is
  // not worth a white screen.
  const ar = typeof name.ar === 'string' ? name.ar : '';
  const en = typeof name.en === 'string' ? name.en : '';

  const preferred = english ? en : ar;

  return preferred.trim() !== '' ? preferred : english ? ar : en;
}

export const bothNames = (name: PersonName): string =>
  name.ar === name.en ? name.ar : `${name.ar} — ${name.en}`;
