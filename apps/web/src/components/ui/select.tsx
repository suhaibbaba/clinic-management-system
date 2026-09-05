import { forwardRef, type SelectHTMLAttributes } from 'react';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
  /** Rendered as the first entry when the field has no value yet. */
  placeholder?: string | undefined;
  hasError?: boolean | undefined;
}

/**
 * A styled native `<select>`, with our own chevron.
 *
 * Deliberately not a headless popover: the native control mirrors correctly in
 * RTL, uses the platform picker on mobile, is keyboard accessible with no code,
 * and stays trivially testable. The headless primitives are reserved for
 * dialogs, menus, toasts and switches, where the platform offers no equivalent.
 *
 * The platform's own arrow is removed (`appearance-none`) and replaced, because
 * it is a different glyph on every OS, always sits on the left, and cannot take
 * the app's ink colour — three ways for one control to look foreign in a row of
 * inputs. Ours is positioned with logical properties and matches the icon set.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className, hasError = false, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={hasError || undefined}
        className={cn(
          'block h-10 w-full cursor-pointer appearance-none rounded-control border bg-surface',
          'ps-3.5 pe-10 text-start text-field text-ink',
          'transition-[border-color,box-shadow,background-color] duration-150',
          'focus:border-primary-500 focus:outline-2 focus:outline-offset-0 focus:outline-primary-600',
          'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
          hasError ? 'border-danger-400 focus:border-danger-500' : 'border-line-strong',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-ink-subtle">
        <Icon name="chevron-down" />
      </span>
    </div>
  );
});
