import { forwardRef, type InputHTMLAttributes } from 'react';

import { Icon, type IconName } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean | undefined;
  /**
   * An icon inside the field, at the start of the line: a magnifier on a
   * search, a handset on a phone number, an envelope on an email. Positioned
   * with logical properties, so it sits on the right in Arabic with no
   * RTL-specific rule.
   */
  adornment?: IconName | undefined;
}

/**
 * The text input every form uses.
 *
 * `text-start` rather than `text-left`, so the value aligns with the reading
 * direction instead of being pinned to one side.
 *
 * Native date and time inputs get their own indicator styled to match: the
 * browser draws a calendar or clock button, and left alone it is a dark
 * system glyph sitting on the wrong side of an Arabic field.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError = false, adornment, ...props },
  ref,
) {
  const field = (
    <input
      ref={ref}
      aria-invalid={hasError || undefined}
      className={cn(
        'block h-10 w-full rounded-control border bg-surface px-3.5 text-start text-field text-ink',
        'transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink-subtle',
        'focus:border-primary-500 focus:outline-2 focus:outline-offset-0 focus:outline-primary-600',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
        // The native calendar/clock picker: same ink as the field's own icons,
        // and a pointer, because it is a button.
        '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
        '[&::-webkit-calendar-picker-indicator]:opacity-60',
        '[&::-webkit-calendar-picker-indicator]:hover:opacity-100',
        adornment !== undefined && 'ps-10',
        hasError ? 'border-danger-500' : 'border-line',
        className,
      )}
      {...props}
    />
  );

  if (adornment === undefined) {
    return field;
  }

  return (
    <div className="relative">
      <span
        className={cn(
          'pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3',
          hasError ? 'text-danger-500' : 'text-ink-subtle',
        )}
      >
        <Icon name={adornment} />
      </span>
      {field}
    </div>
  );
});
