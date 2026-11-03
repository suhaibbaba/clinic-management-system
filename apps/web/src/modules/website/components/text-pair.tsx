import { languageDirection, type LanguageCode, type SiteText } from "@clinic/shared";
import { useState, type FocusEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, FormField, Icon, Input, Textarea } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
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
  const [primary, ...others] = useClinicLanguages();
  const [opened, setOpened] = useState(false);
  const Control = multiline ? Textarea : Input;
  const errorFor = (language: LanguageCode) => errors[`${path}.${language}`];
  const missing = others.filter((language) => missingTranslation(value, language));
  const filled = others.filter((language) => (value[language] ?? "").trim() !== "").length;
  const open = opened || others.some((language) => errorFor(language) !== undefined);
  const panelId = `${id}-translations`;

  const control = (language: LanguageCode, first: boolean): JSX.Element => (
    <Control
      id={`${id}-${language}`}
      data-testid={`text-pair-${id}-${language}`}
      dir={languageDirection(language)}
      lang={language}
      value={value[language] ?? ""}
      {...(first && placeholder !== undefined && { placeholder: t(placeholder) })}
      hasError={errorFor(language) !== undefined}
      onChange={(event) => onChange({ ...value, [language]: event.target.value })}
    />
  );

  if (primary === undefined) {
    return <></>;
  }

  return (
    <div
      data-testid={`text-pair-${id}`}
      {...(!multiline && { "data-span": "half" })}
      className="flex flex-col"
    >
      <div onBlur={leave(`${path}.${primary}`)}>
        <FormField
          label={label}
          {...(labelValues !== undefined && { labelValues })}
          htmlFor={`${id}-${primary}`}
          error={errorFor(primary)}
          {...(hint !== undefined && { hint })}
          {...(required ? { required: true } : { optional: true })}
        >
          {control(primary, true)}
        </FormField>
      </div>

      {others.length > 0 && (
        <div
          data-part="translations"
          className="mt-1.5 overflow-hidden rounded-control border border-line bg-inset"
        >
          <button
            type="button"
            data-testid={`text-pair-${id}-translations`}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpened((current) => !current)}
            className="flex min-h-(--control-h-sm) w-full cursor-pointer items-center gap-2 px-3 text-label text-ink-muted transition-colors hover:text-ink"
          >
            <Icon name="globe" className="size-4 shrink-0" />
            <span>{t("website.editor.translations")}</span>
            <span className="tabular-nums">
              {filled}/{others.length}
            </span>
            {missing.length > 0 && (
              <Badge tone="warning" data-testid={`text-pair-${id}-missing`}>
                {t("website.editor.missing")}
              </Badge>
            )}
            <Icon
              name="chevron-down"
              className={cn("ms-auto size-4 shrink-0 transition-transform", open && "rotate-180")}
            />
          </button>

          {open && (
            <div
              id={panelId}
              data-part="translation-fields"
              className="flex flex-col gap-3 border-t border-line bg-surface p-3"
            >
              {others.map((language) => (
                <div key={language} onBlur={leave(`${path}.${language}`)}>
                  <FormField
                    label={`website.language.${language}`}
                    htmlFor={`${id}-${language}`}
                    error={errorFor(language)}
                    optional
                  >
                    {control(language, false)}
                  </FormField>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
