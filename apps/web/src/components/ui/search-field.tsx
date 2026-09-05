import { forwardRef, type InputHTMLAttributes } from 'react';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Names the field for screen readers; there is no visible label. */
  readonly label: string;
  /**
   * Keyboard hint shown in the trailing chip, e.g. `/`. Pass it only where a
   * shortcut actually focuses this field — a chip that promises a key that
   * does nothing is worse than no chip.
   */
  readonly shortcut?: string | undefined;
}

/**
 * The rounded search field, with the magnifier at the start of the line and an
 * optional keyboard-hint chip at the end.
 *
 * Both are positioned with logical properties (`start`/`end`, `ps`/`pe`), so
 * in Arabic the magnifier sits on the right and the chip on the left with no
 * RTL-specific rule anywhere.
 *
 * `type="search"` for the platform's own clear button and history behaviour;
 * the WebKit decoration is stripped because it lands on the wrong side in RTL
 * and duplicates the chip.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { label, shortcut, className, ...props },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-ink-subtle">
        <Icon name="search" className="size-[18px]" />
      </span>

      <input
        ref={ref}
        type="search"
        aria-label={label}
        className={cn(
          'block h-11 w-full rounded-pill border border-line bg-surface ps-11 text-start text-value text-ink',
          'transition-colors placeholder:text-ink-subtle',
          'focus:border-primary-500 focus:outline-2 focus:outline-offset-0 focus:outline-primary-600',
          '[&::-webkit-search-decoration]:appearance-none [&::-webkit-search-cancel-button]:appearance-none',
          shortcut === undefined ? 'pe-4' : 'pe-14',
        )}
        {...props}
      />

      {shortcut !== undefined && (
        <span
          aria-hidden="true"
          dir="ltr"
          className={cn(
            'pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3',
            'text-ink-subtle',
          )}
        >
          <kbd className="rounded-md border border-line bg-sunken px-1.5 py-0.5 font-sans text-label leading-none">
            {shortcut}
          </kbd>
        </span>
      )}
    </div>
  );
});
