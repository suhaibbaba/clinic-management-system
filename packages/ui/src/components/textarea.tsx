import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@ui/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean | undefined;
}

// The field shell's edge and fill, but not its height: this one grows with what is written in it,
// so it sets a single-line `min-h` from the same token instead. `resize-y` only — dragged wider it
// escapes the form's column and, in RTL, drags from the wrong corner.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, hasError = false, rows = 3, ...props },
  ref,
) {
  const disabled = props.disabled === true;

  return (
    <textarea
      ref={ref}
      data-part="textarea"
      rows={rows}
      aria-invalid={hasError || undefined}
      className={cn(
        'block min-h-(--control-h) w-full resize-y rounded-control border-[1.5px] px-3.5 py-2.5',
        'text-start text-field text-ink placeholder:text-ink-faint',
        'transition-[border-color,box-shadow,background-color] duration-150 outline-none',
        disabled
          ? 'cursor-not-allowed border-transparent bg-inset text-ink-faint'
          : cn(
              'bg-surface',
              hasError
                ? 'border-danger-600 shadow-field-error focus:shadow-field-error-ring'
                : 'border-line-strong hover:border-neutral-400 focus:border-primary-600 focus:shadow-field-focus',
            ),
        className,
      )}
      {...props}
    />
  );
});
