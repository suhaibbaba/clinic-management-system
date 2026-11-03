import { languageDirection, type SiteText } from "@clinic/shared";
import type { FocusEvent, JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, FormField, Input, Textarea } from "@clinic/ui";
import { useClinicLanguages } from "@web/shared/hooks/use-clinic-languages";
import type { FieldErrors } from "@web/shared/lib/form-errors";
import { missingTranslation } from "@web/modules/website/lib/site-draft";

export function TextPair({
  id,
  label,
  labelValues,
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
  readonly labelValues?: Record<string, string | number>;
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
        {t(label, labelValues ?? {})}
        {required && (
          <span aria-hidden="true" className="ms-1 text-danger-600">
            *
          </span>
        )}
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        {languages.map((language, index) => (
          <div key={language} className="relative" onBlur={leave(`${path}.${language}`)}>
            {missingTranslation(value, language) && (
              <Badge
                tone="warning"
                data-testid={`text-pair-${id}-${language}-missing`}
                className="absolute end-0 top-0"
              >
                {t("website.editor.missing")}
              </Badge>
            )}
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
