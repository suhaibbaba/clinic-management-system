import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@web/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean | undefined;
}

/**
 * The multi-line counterpart to `Input`, with the same border, radius, focus
 * treatment and disabled state.
 *
 * It exists because four raw `<textarea>` elements in one visit form had each
 * grown their own copy of those classes — which is how a form ends up with a
 * notes box that focuses differently from the field above it.
 *
 * `resize-y` only: a textarea that can be dragged wider escapes the form's
 * column and, in RTL, drags from the wrong corner.
 */
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
        'block w-full resize-y rounded-control border bg-surface px-3.5 py-2.5',
        'text-start text-field text-ink placeholder:text-ink-subtle',
        'transition-[border-color,box-shadow,background-color] duration-150',
        'focus:border-primary-500 focus:outline-2 focus:outline-offset-0 focus:outline-primary-600',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
        hasError ? 'border-danger-500' : 'border-line',
        className,
      )}
      {...props}
    />
  );
});
