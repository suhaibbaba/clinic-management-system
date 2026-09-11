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
        // 44px everywhere, which is both the reference's drawn height and what WCAG 2.5.8 asks of
        // a tap target — the two agree here, so there is no `lg:` step down.
        'block h-11 w-full rounded-field border bg-canvas px-3.5 text-field text-ink',
        ltrIsland ? 'page-rtl:text-right page-ltr:text-left' : 'text-start',
        'transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-ink-faint',
        'focus:border-primary-600 focus:shadow-ring',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-faint',
        '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
        '[&::-webkit-calendar-picker-indicator]:opacity-60',
        '[&::-webkit-calendar-picker-indicator]:hover:opacity-100',
        // The icon is on the page's start edge either way, so the room for it
        // is too — `ps-10` on an LTR island would reserve it on the far side.
        adornment !== undefined && (ltrIsland ? 'page-rtl:pr-10 page-ltr:pl-10' : 'ps-10'),
        hasError ? 'border-danger-600' : 'border-line',
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
          hasError ? 'text-danger-600' : 'text-ink-faint',
        )}
      >
        <Icon name={adornment} />
      </span>
      {field}
    </div>
  );
});
