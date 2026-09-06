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
      <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-ink-subtle">
        <Icon name="search" className="size-4" />
      </span>

      <input
        ref={ref}
        type="search"
        aria-label={label}
        className={cn(
          // A fill rather than a border: the field is a shape cut out of the
          // page, which is what keeps a toolbar from turning into a row of
          // outlined boxes.
          'chrome-field block h-10 w-full rounded-control ps-10 text-start text-field text-ink',
          'transition-colors duration-150 placeholder:text-ink-subtle',
          '[&::-webkit-search-decoration]:appearance-none [&::-webkit-search-cancel-button]:appearance-none',
          // The chip is desktop-only, so the room made for it is too.
          shortcut === undefined ? 'pe-4' : 'pe-4 md:pe-14',
        )}
        {...props}
      />

      {shortcut !== undefined && (
        <span
          aria-hidden="true"
          dir="ltr"
          className={cn(
            // Hidden on a phone: there is no keyboard to press it with, and a
            // chip promising a key nobody can reach is just clutter in a field
            // that is already short at 390px.
            'pointer-events-none absolute inset-y-0 end-0 hidden items-center pe-3 md:flex',
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
