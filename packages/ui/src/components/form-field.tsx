import { Label } from "@radix-ui/react-label";
import type { JSX, ReactNode } from "react";
import type { FieldError } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { validationMessageKey } from "@ui/lib/validation-message";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface FormFieldProps extends TestIdProps {
  label: string;
  htmlFor: string;
  error?: FieldError | undefined;
  errorKey?: string | undefined;
  hint?: string | undefined;
  hintValues?: Record<string, string | number> | undefined;
  optional?: boolean | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  errorKey,
  hint,
  hintValues,
  optional = false,
  required = false,
  children,
  "data-testid": testId,
}: FormFieldProps): JSX.Element {
  const { t } = useTranslation();
  const derived = validationMessageKey(error);
  const messageKey =
    derived === "errors.validation.required" ? derived : error ? (errorKey ?? derived) : undefined;
  const errorId = `${htmlFor}-error`;
  const part = parts("form-field", testId ?? `${htmlFor}-field`);

  return (
    <div {...part()} className="flex flex-col gap-1.5">
      <Label
        htmlFor={htmlFor}
        {...part("label")}
        className="cursor-pointer text-label font-medium text-ink"
      >
        {t(label)}
        {required && (
          <span {...part("required")} aria-hidden="true" className="ms-1 text-danger-600">
            *
          </span>
        )}
        {optional && (
          <span {...part("optional")} className="ms-1 text-label text-ink-subtle">
            ({t("common.optional")})
          </span>
        )}
      </Label>

      {children}

      {hint !== undefined && !messageKey && (
        <p {...part("hint")} className="text-label text-ink-muted">
          {t(hint, hintValues ?? {})}
        </p>
      )}

      {messageKey !== undefined && (
        <p
          id={errorId}
          {...part("error")}
          role="alert"
          className={cn("flex items-start gap-1.5 text-value leading-label text-danger-700")}
        >
          <Icon name="error" className="mt-0.5 size-4 shrink-0" />
          {t(messageKey)}
        </p>
      )}
    </div>
  );
}
