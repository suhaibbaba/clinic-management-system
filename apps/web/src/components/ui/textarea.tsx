import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@web/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean | undefined;
}

// `resize-y` only: a textarea dragged wider escapes the form's column and, in RTL, drags from the
// wrong corner.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, hasError = false, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={hasError || undefined}
      className={cn(
        'block w-full resize-y rounded-field border bg-canvas px-3.5 py-2.5',
        'text-start text-field text-ink placeholder:text-ink-faint',
        'transition-[border-color,box-shadow,background-color] duration-200',
        'focus:border-primary-600 focus:shadow-ring',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-faint',
        hasError ? 'border-danger-600' : 'border-line',
        className,
      )}
      {...props}
    />
  );
});
