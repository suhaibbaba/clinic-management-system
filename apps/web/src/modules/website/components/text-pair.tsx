import { languageDirection, type SiteText } from "@clinic/shared";
import type { FocusEvent, JSX } from "react";
import { useTranslation } from "react-i18next";
import { FormField, Input, Textarea } from "@clinic/ui";
import { useClinicLanguages } from "@web/shared/hooks/use-clinic-languages";
import type { FieldErrors } from "@web/shared/lib/form-errors";

export function TextPair({
  id,
  label,
  value,
  onChange,
  errors,
  path,
  leave,
  multiline = false,
  required = false,
  hint,
  placeholder,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: SiteText;
  readonly onChange: (value: SiteText) => void;
  readonly errors: FieldErrors;
  readonly path: string;
  readonly leave: (field: string) => (event: FocusEvent<HTMLElement>) => void;
  readonly multiline?: boolean;
  readonly required?: boolean;
  readonly hint?: string;
  readonly placeholder?: string;
}): JSX.Element {
  const { t } = useTranslation();
  const languages = useClinicLanguages();
  const Control = multiline ? Textarea : Input;

  return (
    <fieldset data-testid={`text-pair-${id}`} className="flex flex-col gap-2">
      <legend className="mb-1 text-value font-medium text-ink">
        {t(label)}
        {required && (
          <span aria-hidden="true" className="ms-1 text-danger-600">
            *
          </span>
        )}
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        {languages.map((language, index) => (
          <div key={language} onBlur={leave(`${path}.${language}`)}>
            <FormField
              label={`website.language.${language}`}
              htmlFor={`${id}-${language}`}
              error={errors[`${path}.${language}`]}
              hint={index === 0 ? hint : undefined}
              optional={index > 0}
            >
              <Control
                id={`${id}-${language}`}
                data-testid={`text-pair-${id}-${language}`}
                dir={languageDirection(language)}
                lang={language}
                value={value[language] ?? ""}
                {...(index === 0 && placeholder !== undefined && { placeholder: t(placeholder) })}
                hasError={errors[`${path}.${language}`] !== undefined}
                onChange={(event) => onChange({ ...value, [language]: event.target.value })}
              />
            </FormField>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
