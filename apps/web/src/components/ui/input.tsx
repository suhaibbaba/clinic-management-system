import { forwardRef, type InputHTMLAttributes } from 'react';

import { Icon, type IconName } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean | undefined;
  adornment?: IconName | undefined;
}

// `dir="ltr"` fields are handled here, not at the call site: `text-start` and `ps-*` would resolve
// against the field, putting its value and icon room on the left of an Arabic form.
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
