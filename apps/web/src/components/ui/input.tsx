import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@web/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean | undefined;
}

/**
 * `text-start` rather than `text-left`, so the value aligns with the reading
 * direction instead of being pinned to one side.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'block h-10 w-full rounded-md border bg-white px-3 text-start text-sm text-gray-900',
        'placeholder:text-gray-400 focus:outline-2 focus:outline-offset-0 focus:outline-brand-600',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
        hasError ? 'border-red-400' : 'border-gray-300',
        className,
      )}
      {...props}
    />
  );
});
