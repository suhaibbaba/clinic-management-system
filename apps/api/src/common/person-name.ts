import { personName, type PersonName } from '@clinic/shared';

// One function rather than an object literal at eight call sites, so a null name — the waiting
// list's "any doctor" — is handled the same way everywhere.
export function toPersonName(ar: string, en: string): PersonName {
  return { ar, en };
}

export function toOptionalPersonName(ar: string | null, en: string | null): PersonName | null {
  return ar === null || en === null ? null : { ar, en };
}

// Always Arabic, with English as the fallback: a WhatsApp text is not a screen with a language
// toggle on it.
export const notificationName = (name: PersonName): string => personName(name, 'ar');
