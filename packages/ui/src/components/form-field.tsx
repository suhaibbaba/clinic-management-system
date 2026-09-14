import { Label } from '@radix-ui/react-label';
import type { JSX, ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Icon } from '@ui/components/icon';
import { cn } from '@ui/lib/cn';
import { validationMessageKey } from '@ui/lib/validation-message';

export interface FormFieldProps {
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
}: FormFieldProps): JSX.Element {
  const { t } = useTranslation();
  const messageKey = error ? (errorKey ?? validationMessageKey(error)) : undefined;
  const errorId = `${htmlFor}-error`;

  return (
    <div data-part="form-field" className="flex flex-col gap-1.5">
      <Label
        htmlFor={htmlFor}
        data-part="form-field-label"
        className="cursor-pointer text-label font-medium text-ink"
      >
        {t(label)}
        {required && (
          // Decorative: the control itself carries `required`/`aria-required`,
          // which is what a screen reader announces.
          <span data-part="form-field-required" aria-hidden="true" className="ms-1 text-danger-600">
            *
          </span>
        )}
        {optional && (
          <span data-part="form-field-optional" className="ms-1 text-label text-ink-subtle">
            ({t('common.optional')})
          </span>
        )}
      </Label>

      {children}

      {hint !== undefined && !messageKey && (
        <p data-part="form-field-hint" className="text-label text-ink-muted">
          {t(hint)}
        </p>
      )}

      {messageKey !== undefined && (
        <p
          id={errorId}
          data-part="form-field-error"
          role="alert"
          className={cn('flex items-center gap-1.5 text-value text-danger-700')}
        >
          <Icon name="error" className="size-4" />
          {t(messageKey)}
        </p>
      )}
    </div>
  );
}
