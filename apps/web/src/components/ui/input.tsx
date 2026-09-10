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
 * **`dir="ltr"` fields are the exception, and they are handled here rather
 * than at the call site.** A phone number, an amount or an OTP is typed
 * left-to-right whatever the page says — that is what the attribute is for —
 * but `text-start` and `ps-*` then resolve against the *field's* direction,
 * so an Arabic form ended up with one field whose value and whose icon room
 * sat on the left while its label and every field around it sat on the right.
 * The `rtl:`/`ltr:` variants ask the page instead, which is the answer for
 * both languages: the number reads left-to-right inside a box that belongs to
 * the line it is on.
 *
 * Native date and time inputs get their own indicator styled to match: the
 * browser draws a calendar or clock button, and left alone it is a dark
 * system glyph sitting on the wrong side of an Arabic field.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError = false, adornment, ...props },
  ref,
) {
  const ltrIsland = props.dir === 'ltr';

  const field = (
    <input
      ref={ref}
      aria-invalid={hasError || undefined}
      className={cn(
        // 44px on touch, the drawn 36 from `lg` up: a field is a tap target
        // before it is a box, and 36px is under the 44 WCAG 2.5.8 asks for.
        'block h-11 w-full rounded-control border bg-surface px-3 text-field text-ink lg:h-9',
        ltrIsland ? 'page-rtl:text-right page-ltr:text-left' : 'text-start',
        'transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink-subtle',
        'focus:border-primary-500',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
        // The native calendar/clock picker: same ink as the field's own icons,
        // and a pointer, because it is a button.
        '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
        '[&::-webkit-calendar-picker-indicator]:opacity-60',
        '[&::-webkit-calendar-picker-indicator]:hover:opacity-100',
        // The icon is on the page's start edge either way, so the room for it
        // is too — `ps-10` on an LTR island would reserve it on the far side.
        adornment !== undefined && (ltrIsland ? 'page-rtl:pr-10 page-ltr:pl-10' : 'ps-10'),
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
