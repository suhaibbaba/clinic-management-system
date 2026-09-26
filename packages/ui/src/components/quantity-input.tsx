import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@ui/components/input";
import { cn } from "@ui/lib/cn";
import { foldDigits } from "@ui/lib/digits";

export type QuantityInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "dir"
>;

export function cleanQuantity(value: string): string {
  return foldDigits(value).replace(/\D/gu, "");
}

// `numeric`, not `decimal`: the pad then has no separator key to press by mistake.
export const QuantityInput = forwardRef<HTMLInputElement, QuantityInputProps>(
  function QuantityInput({ className, onChange, ...props }, ref) {
    return (
      <Input
        ref={ref}
        data-part="quantity-input"
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        className={cn("tabular-nums", className)}
        onChange={(event) => {
          const cleaned = cleanQuantity(event.target.value);

          if (cleaned !== event.target.value) {
            event.target.value = cleaned;
          }

          onChange?.(event);
        }}
        {...props}
      />
    );
  },
);
