import { Label } from '@radix-ui/react-label';
import type { JSX, ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';
import { validationMessageKey } from '@web/lib/validation-message';

export interface FormFieldProps {
  /** i18n key for the label. */
  label: string;
  htmlFor: string;
  error?: FieldError | undefined;
  /** Overrides the code-derived message when a rule needs specific wording. */
  errorKey?: string | undefined;
  hint?: string | undefined;
  optional?: boolean | undefined;
  /**
   * Marks the field required with an asterisk. A field is required unless it
   * says `optional`, so this is for the few places the marker earns its keep —
   * a long form where the optional ones are the minority.
   */
  required?: boolean | undefined;
  children: ReactNode;
}

/**
 * Label above the control, then the control, then one line underneath: a hint
 * while the field is clean, the error once it is not.
 *
 * The hint and the error share a slot rather than stacking, so a field does not
 * grow taller when it fails and shove the rest of the form down the page.
 *
 * The message comes from the Zod issue *code* rather than the schema's English
 * text, so every string on screen still comes from the i18n files.
 */
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
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="cursor-pointer text-label font-medium text-ink">
        {t(label)}
        {required && (
          // Decorative: the control itself carries `required`/`aria-required`,
          // which is what a screen reader announces.
          <span aria-hidden="true" className="ms-1 text-danger-600">
            *
          </span>
        )}
        {optional && (
          <span className="ms-1 text-label text-ink-subtle">({t('common.optional')})</span>
        )}
      </Label>

      {children}

      {hint !== undefined && !messageKey && <p className="text-label text-ink-muted">{t(hint)}</p>}

      {messageKey !== undefined && (
        <p
          id={errorId}
          role="alert"
          className={cn('flex items-center gap-1.5 text-label text-danger-700')}
        >
          <Icon name="error" className="size-4" />
          {t(messageKey)}
        </p>
      )}
    </div>
  );
}
