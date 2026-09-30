import { currencySymbol } from "@clinic/shared";
import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@ui/components/input";
import { cn } from "@ui/lib/cn";

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "dir"
> {
  hasError?: boolean | undefined;
  currency?: string | undefined;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { currency, className, ...props },
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
      {...props}
    />
  );
});
