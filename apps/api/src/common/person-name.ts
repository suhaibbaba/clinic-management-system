import { personName, type PersonName } from '@clinic/shared';

export function toPersonName(ar: string, en: string): PersonName {
  return { ar, en };
}

export function toOptionalPersonName(ar: string | null, en: string | null): PersonName | null {
  return ar === null || en === null ? null : { ar, en };
}

export const notificationName = (name: PersonName): string => personName(name, 'ar');
