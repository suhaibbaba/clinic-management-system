import { Label } from '@radix-ui/react-label';
import type { JSX, ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

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
  children: ReactNode;
}

/**
 * Label, control and validation message.
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
  children,
}: FormFieldProps): JSX.Element {
  const { t } = useTranslation();
  const messageKey = error ? (errorKey ?? validationMessageKey(error)) : undefined;
  const errorId = `${htmlFor}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {t(label)}
        {optional && <span className="ms-1 text-xs text-ink-subtle">({t('common.optional')})</span>}
      </Label>

      {children}

      {hint !== undefined && !messageKey && <p className="text-xs text-ink-muted">{t(hint)}</p>}

      {messageKey !== undefined && (
        <p id={errorId} role="alert" className={cn('text-xs text-danger-600')}>
          {t(messageKey)}
        </p>
      )}
    </div>
  );
}
