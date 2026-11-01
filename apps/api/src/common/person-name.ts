import { localized, type LocalizedText, type PersonName } from "@clinic/shared";

export const toOptionalPersonName = (name: LocalizedText | null | undefined): PersonName | null =>
  name ?? null;

export const notificationName = (name: PersonName, language: string): string =>
  localized(name, language);
