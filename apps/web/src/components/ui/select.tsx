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
    /*
     * `className` sizes the *wrapper*, and the field fills it.
     *
     * The chevron is positioned against this element, so putting a width on
     * the `<select>` instead left the two at different widths: a `w-56`
     * currency field on a full-width row drew its arrow four hundred pixels
     * to the right of the box it belongs to. Every caller passes width or
     * margin here, which is a property of the control as a whole anyway.
     */
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        aria-invalid={hasError || undefined}
        className={cn(
          'block h-10 w-full cursor-pointer appearance-none rounded-control border bg-surface',
          'ps-3.5 pe-10 text-start text-field text-ink',
          'transition-[border-color,box-shadow,background-color] duration-150',
          'focus:border-primary-500',
          'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
          hasError ? 'border-danger-500' : 'border-line',
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
