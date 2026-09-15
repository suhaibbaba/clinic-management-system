import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { FIELD_TEXT, FieldClear, FieldIcon, FieldLock, fieldShell } from '@ui/components/field';
import type { IconName } from '@ui/components/icon';
import { cn } from '@ui/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean | undefined;
  adornment?: IconName | undefined;
  /** Draws a clear button at the inline end; the caller decides what empty means. */
  onClear?: (() => void) | undefined;
  clearLabel?: string | undefined;
  /** Sits at the inline end, inside the field — a currency symbol, a unit. */
  suffix?: ReactNode | undefined;
  /** Names the shell for a product's own CSS — see the package README. */
  'data-part'?: string | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    hasError = false,
    adornment,
    onClear,
    clearLabel,
    suffix,
    'data-part': part = 'input',
    ...props
  },
  ref,
) {
  const direction = props.dir ?? 'auto';
  const disabled = props.disabled === true;
  const clearable = onClear !== undefined && !disabled && String(props.value ?? '') !== '';

  return (
    <div data-part={part} className={cn(fieldShell({ hasError, disabled }), className)}>
      {adornment !== undefined && (
        <FieldIcon name={adornment} hasError={hasError} disabled={disabled} />
      )}

      <input
        ref={ref}
        data-part="input-control"
        aria-invalid={hasError || undefined}
        className={cn(
          FIELD_TEXT,
          'page-rtl:text-right page-ltr:text-left',
          '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
          '[&::-webkit-calendar-picker-indicator]:opacity-60',
          '[&::-webkit-calendar-picker-indicator]:transition-opacity',
          '[&::-webkit-calendar-picker-indicator]:duration-150',
          '[&::-webkit-calendar-picker-indicator]:hover:opacity-100',
        )}
        {...props}
        dir={direction}
      />

      {clearable && clearLabel !== undefined && <FieldClear label={clearLabel} onClear={onClear} />}

      {suffix !== undefined && (
        <span data-part="input-suffix" className="shrink-0 text-value text-ink-muted">
          {suffix}
        </span>
      )}

      {disabled && <FieldLock />}
    </div>
  );
});
