import { currencySymbol } from "@clinic/shared";
import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@ui/components/input";
import { cn } from "@ui/lib/cn";
import { foldDigits } from "@ui/lib/digits";

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "dir"
> {
  hasError?: boolean | undefined;
  currency?: string | undefined;
}

/** Everything but digits, dropped as it is typed — an Arabic keypad's digits kept, not dropped. */
const digitsOnly = (value: string): string => foldDigits(value).replace(/\D/g, "");

// Refuses a decimal separator as it is typed: on a numeric keypad a stray `.` turns 6000 into 60.00
// silently. `inputMode="numeric"`, since `decimal` puts that key on the pad.
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { currency, className, onChange, ...props },
  ref,
) {
  const symbol = currencySymbol(currency);

  return (
    <Input
      ref={ref}
      data-part="money-input"
      {...(symbol !== "" && { suffix: symbol })}
      // The digits read left to right whatever the page says; `Input` keeps the
      // field's *alignment* with the page (see its own note).
      dir="ltr"
      inputMode="numeric"
      autoComplete="off"
      className={cn("tabular-nums", className)}
      onChange={(event) => {
        const cleaned = digitsOnly(event.target.value);

        if (cleaned !== event.target.value) {
          event.target.value = cleaned;
        }

        onChange?.(event);
      }}
      {...props}
    />
  );
});
