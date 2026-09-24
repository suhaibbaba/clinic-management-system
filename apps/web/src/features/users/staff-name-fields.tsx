import type { PersonNameInput } from "@clinic/shared";
import type { JSX } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormField, Input } from "@clinic/ui";

export interface StaffNameValues {
  firstName: PersonNameInput;
  lastName: PersonNameInput;
}

export interface StaffNameFieldsProps {
  /** Prefixes every field's id and testid, e.g. `user` gives `user-field-first-name-ar`. */
  readonly prefix: string;
  readonly register: UseFormRegister<StaffNameValues>;
  readonly errors: FieldErrors<StaffNameValues>;
}

const FIELDS = [
  { path: "firstName.ar", label: "users.firstNameAr", placeholder: "firstNameAr", ltr: false },
  { path: "lastName.ar", label: "users.lastNameAr", placeholder: "lastNameAr", ltr: false },
  { path: "firstName.en", label: "users.firstNameEn", placeholder: "firstNameEn", ltr: true },
  { path: "lastName.en", label: "users.lastNameEn", placeholder: "lastNameEn", ltr: true },
] as const;

/** First and last name in both languages: staff are a small set the clinic can spell twice. */
export function StaffNameFields({ prefix, register, errors }: StaffNameFieldsProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((field) => {
        const [part, language] = field.path.split(".") as ["firstName" | "lastName", "ar" | "en"];
        const id = `${prefix}-${part === "firstName" ? "first" : "last"}-name-${language}`;
        const error = errors[part]?.[language];

        return (
          <FormField key={field.path} label={field.label} htmlFor={id} error={error}>
            <Input
              placeholder={t(`common.placeholders.${field.placeholder}`)}
              adornment="user"
              id={id}
              data-testid={`${prefix}-field-${part === "firstName" ? "first" : "last"}-name-${language}`}
              {...(field.ltr && { dir: "ltr" })}
              hasError={error !== undefined}
              {...register(field.path)}
            />
          </FormField>
        );
      })}
    </div>
  );
}
