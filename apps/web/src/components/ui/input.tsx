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
        'block h-10 w-full rounded-md border bg-surface px-3 text-start text-sm text-ink',
        'placeholder:text-ink-subtle focus:outline-2 focus:outline-offset-0 focus:outline-primary-600',
        'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-subtle',
        hasError ? 'border-danger-400' : 'border-line-strong',
        className,
      )}
      {...props}
    />
  );
});
