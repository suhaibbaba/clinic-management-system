import { forwardRef } from "react";

import { Input, type InputProps } from "@ui/components/input";
import { cn } from "@ui/lib/cn";
import { foldDigits } from "@ui/lib/digits";

/** Everything `Input` takes — an adornment, a clear button — bar what this field decides itself. */
export type PhoneInputProps = Omit<InputProps, "type" | "inputMode" | "dir">;

/** Digits, spaces and dashes, and a `+` only at the front — where a dialling code puts it. */
const phoneCharacters = (value: string): string =>
  foldDigits(value)
    .replace(/[^\d\s+-]/g, "")
    .replace(/(?!^)\+/g, "");

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { className, onChange, ...props },
  ref,
) {
  return (
    <Input
      ref={ref}
      data-part="phone-input"
      type="tel"
      // The digits read left to right whatever the page says; `Input` keeps the field's
      // *alignment* with the page (see its own note).
      dir="ltr"
      inputMode="tel"
      autoComplete="tel"
      className={cn("tabular-nums", className)}
      onChange={(event) => {
        const cleaned = phoneCharacters(event.target.value);

        if (cleaned !== event.target.value) {
          event.target.value = cleaned;
        }

        onChange?.(event);
      }}
      {...props}
    />
  );
});
