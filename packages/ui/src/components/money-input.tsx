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

const digitsOnly = (value: string): string => foldDigits(value).replace(/\D/g, "");

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
