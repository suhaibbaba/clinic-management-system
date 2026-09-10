import { currencySymbol } from '@clinic/shared';
import { forwardRef, type InputHTMLAttributes } from 'react';

import { Input } from '@web/components/ui/input';
import { cn } from '@web/lib/cn';

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'dir'
> {
  hasError?: boolean | undefined;
  currency?: string | undefined;
}

/** Everything but digits, dropped as it is typed. */
const digitsOnly = (value: string): string => value.replace(/\D/g, '');

// Refuses a decimal separator as it is typed: on a numeric keypad a stray `.` turns 6000 into 60.00
// silently. `inputMode="numeric"`, since `decimal` puts that key on the pad.
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { currency, className, onChange, ...props },
  ref,
) {
  const symbol = currencySymbol(currency);

  const field = (
    <Input
      ref={ref}
      // The digits read left to right whatever the page says; `Input` keeps the
      // field's *alignment* with the page (see its own note).
      dir="ltr"
      inputMode="numeric"
      autoComplete="off"
      className={cn('tabular-nums', className)}
      onChange={(event) => {
        const cleaned = digitsOnly(event.target.value);

        if (cleaned !== event.target.value) {
          // Rewritten before it reaches the form, so a pasted "60.50" becomes
          // 6050 rather than being silently accepted and rejected on submit.
          event.target.value = cleaned;
        }

        onChange?.(event);
      }}
      {...props}
    />
  );

  if (symbol === '') {
    return field;
  }

  return (
    <span className="flex items-center gap-2">
      {field}
      <span className="shrink-0 text-value text-ink-muted">{symbol}</span>
    </span>
  );
});
