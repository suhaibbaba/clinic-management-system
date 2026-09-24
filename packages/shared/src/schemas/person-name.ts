import { z } from "zod";

// Staff and clinic names only — a patient's is in one language. One object on the wire, so
// `personName()` takes a single value.
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

/** One half of a staff name, in both languages. */
export const personNamePartInputSchema = z.object({
  ar: z.string().trim().min(1).max(60),
  en: z.string().trim().min(1).max(60),
});

/** A staff name as written: first and last, each in both languages. */
export const staffNameInputFields = {
  firstName: personNamePartInputSchema,
  lastName: personNamePartInputSchema,
};

/** The full staff name the API stores beside the parts. */
export const joinPersonName = (
  firstName: PersonNameInput,
  lastName: PersonNameInput,
): PersonName => ({ ar: `${firstName.ar} ${lastName.ar}`, en: `${firstName.en} ${lastName.en}` });

/** A patient's full name from its parts, as the API stores it. */
export const joinPatientName = (parts: {
  readonly firstName: string;
  readonly middleName?: string | null | undefined;
  readonly lastName: string;
}): string =>
  [parts.firstName, parts.middleName, parts.lastName]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" ");

// The fallback is the migration: names were copied into both columns, and a clinic that since
// filled only Arabic must not get a blank English calendar. `language` matches by prefix.
export function personName(name: PersonName | null | undefined, language: string): string {
  if (!name) {
    return "";
  }

  const english = language.startsWith("en");
  const ar = typeof name.ar === "string" ? name.ar : "";
  const en = typeof name.en === "string" ? name.en : "";

  const preferred = english ? en : ar;

  return preferred.trim() !== "" ? preferred : english ? ar : en;
}

export const bothNames = (name: PersonName): string =>
  name.ar === name.en ? name.ar : `${name.ar} — ${name.en}`;
