import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '@web/lib/cn';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
  /** Rendered as a disabled first entry when the field has no value yet. */
  placeholder?: string | undefined;
  hasError?: boolean | undefined;
}

/**
 * A styled native `<select>`.
 *
 * Deliberately not a headless popover: the native control mirrors correctly in
 * RTL, uses the platform picker on mobile, is keyboard accessible with no code,
 * and stays trivially testable. The headless primitives are reserved for
 * dialogs, toasts and switches, where the platform offers no equivalent.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className, hasError = false, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'block h-10 w-full appearance-none rounded-md border bg-white px-3 text-start text-sm',
        'text-gray-900 focus:outline-2 focus:outline-offset-0 focus:outline-brand-600',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
        hasError ? 'border-red-400' : 'border-gray-300',
        className,
      )}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});
