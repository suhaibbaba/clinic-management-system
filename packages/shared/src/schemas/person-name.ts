import { z } from "zod";

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

export const personNamePartInputSchema = z.object({
  ar: z.string().trim().min(1).max(60),
  en: z.string().trim().min(1).max(60),
});

export const staffNameInputFields = {
  firstName: personNamePartInputSchema,
  lastName: personNamePartInputSchema,
};

export const joinPersonName = (
  firstName: PersonNameInput,
  lastName: PersonNameInput,
): PersonName => ({ ar: `${firstName.ar} ${lastName.ar}`, en: `${firstName.en} ${lastName.en}` });

export const joinPatientName = (parts: {
  readonly firstName: string;
  readonly middleName?: string | null | undefined;
  readonly lastName: string;
}): string =>
  [parts.firstName, parts.middleName, parts.lastName]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" ");

export const bothNames = (name: PersonName): string =>
  name.ar === name.en ? name.ar : `${name.ar} — ${name.en}`;
