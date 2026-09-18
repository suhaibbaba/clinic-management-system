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
  /** Overrides the code-derived message when a rule needs specific wording. */
  errorKey?: string | undefined;
  hint?: string | undefined;
  optional?: boolean | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}

// Hint and error share a slot, so a field does not grow taller when it fails. The message comes
// from the Zod issue code, never the schema's English text.
export function FormField({
  label,
  htmlFor,
  error,
  errorKey,
  hint,
  optional = false,
  required = false,
  children,
  "data-testid": testId,
}: FormFieldProps): JSX.Element {
  const { t } = useTranslation();
  const messageKey = error ? (errorKey ?? validationMessageKey(error)) : undefined;
  const errorId = `${htmlFor}-error`;
  // Defaults to the control it labels, so every form in the app is addressable without a call site
  // naming each field twice.
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
          // Decorative: the control itself carries `required`/`aria-required`,
          // which is what a screen reader announces.
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
          {t(hint)}
        </p>
      )}

      {messageKey !== undefined && (
        <p
          id={errorId}
          {...part("error")}
          role="alert"
          className={cn("flex items-center gap-1.5 text-value text-danger-700")}
        >
          <Icon name="error" className="size-4" />
          {t(messageKey)}
        </p>
      )}
    </div>
  );
}
