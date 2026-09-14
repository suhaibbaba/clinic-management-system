import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { FIELD_TEXT, FieldClear, FieldIcon, FieldLock, fieldShell } from '@web/components/ui/field';
import type { IconName } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean | undefined;
  adornment?: IconName | undefined;
  /** Draws a clear button at the inline end; the caller decides what empty means. */
  onClear?: (() => void) | undefined;
  clearLabel?: string | undefined;
  /** Sits at the inline end, inside the field — a currency symbol, a unit. */
  suffix?: ReactNode | undefined;
}

// `dir="ltr"` fields are handled here, not at the call site: `text-start` would resolve against the
// field, putting a phone number on the left of an Arabic form. The attribute is inline isolation
// for a Latin value — the page's direction still decides where the value sits.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError = false, adornment, onClear, clearLabel, suffix, ...props },
  ref,
) {
  const ltrIsland = props.dir === 'ltr';
  const disabled = props.disabled === true;
  const clearable = onClear !== undefined && !disabled && String(props.value ?? '') !== '';

  return (
    <div className={cn(fieldShell({ hasError, disabled }), className)}>
      {adornment !== undefined && (
        <FieldIcon name={adornment} hasError={hasError} disabled={disabled} />
      )}

      <input
        ref={ref}
        aria-invalid={hasError || undefined}
        className={cn(
          FIELD_TEXT,
          ltrIsland ? 'page-rtl:text-right page-ltr:text-left' : 'text-start',
          '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
          '[&::-webkit-calendar-picker-indicator]:opacity-60',
          '[&::-webkit-calendar-picker-indicator]:hover:opacity-100',
        )}
        {...props}
      />

      {clearable && clearLabel !== undefined && <FieldClear label={clearLabel} onClear={onClear} />}

      {suffix !== undefined && <span className="shrink-0 text-value text-ink-muted">{suffix}</span>}

      {disabled && <FieldLock />}
    </div>
  );
});
