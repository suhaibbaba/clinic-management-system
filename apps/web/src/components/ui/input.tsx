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
        'block h-11 w-full rounded-control border bg-surface px-3.5 text-start text-value text-ink',
        'transition-colors placeholder:text-ink-subtle',
        'focus:border-primary-500 focus:outline-2 focus:outline-offset-0 focus:outline-primary-600',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
        hasError ? 'border-danger-400' : 'border-line-strong',
        className,
      )}
      {...props}
    />
  );
});
