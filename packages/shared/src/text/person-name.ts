import { localized, localizedValues, type LocalizedText } from "@shared/locale/localized-text";

export function personName(
  name: LocalizedText | null | undefined,
  language: string,
  fallbacks: readonly string[] = [],
): string {
  return localized(name, language, fallbacks);
}

export const bothNames = (name: LocalizedText): string => localizedValues(name).join(" — ");
