import type { SiteText } from "@clinic/shared";
import type { FocusEvent, JSX } from "react";
import { useTranslation } from "react-i18next";
import { FormField, Input, Textarea } from "@clinic/ui";
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
        <div onBlur={leave(`${path}.ar`)}>
          <FormField
            label="website.language.ar"
            htmlFor={`${id}-ar`}
            error={errors[`${path}.ar`]}
            {...(hint !== undefined && { hint })}
          >
            <Control
              id={`${id}-ar`}
              data-testid={`text-pair-${id}-ar`}
              dir="rtl"
              value={value.ar}
              {...(placeholder !== undefined && { placeholder: t(placeholder) })}
              hasError={errors[`${path}.ar`] !== undefined}
              onChange={(event) => onChange({ ...value, ar: event.target.value })}
            />
          </FormField>
        </div>

        <div onBlur={leave(`${path}.en`)}>
          <FormField
            label="website.language.en"
            htmlFor={`${id}-en`}
            error={errors[`${path}.en`]}
            optional
          >
            <Control
              id={`${id}-en`}
              data-testid={`text-pair-${id}-en`}
              dir="ltr"
              lang="en"
              value={value.en}
              hasError={errors[`${path}.en`] !== undefined}
              onChange={(event) => onChange({ ...value, en: event.target.value })}
            />
          </FormField>
        </div>
      </div>
    </fieldset>
  );
}
