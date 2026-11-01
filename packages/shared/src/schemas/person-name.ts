import {
  localizedTextInputSchema,
  localizedTextSchema,
  type LocalizedText,
} from "@shared/locale/localized-text";
import { LANGUAGE_CODES } from "@shared/locale/languages";

export const personNameSchema = localizedTextSchema;
export type PersonName = LocalizedText;

export const personNameInputSchema = localizedTextInputSchema(2, 120);
export type PersonNameInput = LocalizedText;

export const personNamePartInputSchema = localizedTextInputSchema(1, 60);

export const staffNameInputFields = {
  firstName: personNamePartInputSchema,
  lastName: personNamePartInputSchema,
};

export const joinPersonName = (firstName: LocalizedText, lastName: LocalizedText): LocalizedText =>
  Object.fromEntries(
    LANGUAGE_CODES.flatMap((code) => {
      const parts = [firstName[code], lastName[code]].filter(
        (part): part is string => typeof part === "string" && part.trim() !== "",
      );

      return parts.length > 0 ? [[code, parts.join(" ")]] : [];
    }),
  ) as LocalizedText;

export const joinPatientName = (parts: {
  readonly firstName: string;
  readonly middleName?: string | null | undefined;
  readonly lastName: string;
}): string =>
  [parts.firstName, parts.middleName, parts.lastName]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" ");
