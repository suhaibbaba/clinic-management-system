import { isRtlLanguage, type PersonNameInput } from "@clinic/shared";
import type { JSX } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormField, Input } from "@clinic/ui";
import { STAFF_NAME_LABELS, STAFF_NAME_PARTS } from "@web/shared/constants/staff";
import { useClinicLanguages } from "@web/shared/hooks/use-clinic-languages";

export interface StaffNameValues {
  firstName: PersonNameInput;
  lastName: PersonNameInput;
}

export interface StaffNameFieldsProps {
  readonly prefix: string;
  readonly register: UseFormRegister<StaffNameValues>;
  readonly errors: FieldErrors<StaffNameValues>;
}

export function StaffNameFields({ prefix, register, errors }: StaffNameFieldsProps): JSX.Element {
  const { t } = useTranslation();
  const languages = useClinicLanguages();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {languages.flatMap((language) =>
        STAFF_NAME_PARTS.map((part) => {
          const slug = part === "firstName" ? "first" : "last";
          const id = `${prefix}-${slug}-name-${language}`;
          const error = errors[part]?.[language] ?? errors[part]?.root;
          const inLanguage = t(`languages.in.${language}`);

          return (
            <FormField
              key={`${part}.${language}`}
              label={STAFF_NAME_LABELS[part]}
              labelValues={{ language: inLanguage }}
              htmlFor={id}
              error={error}
            >
              <Input
                placeholder={t(`common.placeholders.${part}In`, { language: inLanguage })}
                adornment="user"
                id={id}
                data-testid={`${prefix}-field-${slug}-name-${language}`}
                {...(!isRtlLanguage(language) && { dir: "ltr" })}
                lang={language}
                hasError={error !== undefined}
                {...register(`${part}.${language}`)}
              />
            </FormField>
          );
        }),
      )}
    </div>
  );
}
