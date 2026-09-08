import { currencySymbol } from '@clinic/shared';
import { forwardRef, type InputHTMLAttributes } from 'react';

import { Input } from '@web/components/ui/input';
import { cn } from '@web/lib/cn';

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'dir'
> {
  hasError?: boolean | undefined;
  /** ISO-4217 from the clinic setting; shown beside the field as its symbol. */
  currency?: string | undefined;
}

/** Everything but digits, dropped as it is typed. */
const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/**
 * A price, typed as a whole number.
 *
 * Prices here are whole units — a filling is 60, not 60.00 — so the field
 * refuses a decimal separator outright rather than accepting one and failing
 * validation on submit. That is not only tidiness: `.` and `,` are one key
 * apart from nothing at all on a numeric keypad, and a stray separator turns
 * 6000 into 60.00 silently, which is the money bug worth designing out.
 * `wholeMoneySchema` is the real gate — the API is the boundary — and this is
 * what stops the mistake being made in the first place.
 *
 * The currency's **symbol** sits beside the field, never its code, matching
 * what `Money` renders everywhere else. It follows the page's flow rather than
 * being pinned to an edge, so an Arabic form reads "المبلغ: 150 د.ا".
 *
 * `inputMode="numeric"`, not `"decimal"`: `decimal` is what puts the separator
 * on the phone keypad this field will not accept.
 */
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
