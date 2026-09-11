import { forwardRef, type InputHTMLAttributes } from 'react';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Names the field for screen readers; there is no visible label. */
  readonly label: string;
  // Pass it only where a shortcut actually focuses this field — a chip promising a key that does
  // nothing is worse than no chip.
  readonly shortcut?: string | undefined;
}

// `type="search"` for the platform's clear button; its WebKit decoration is stripped because it
// lands on the wrong side in RTL and duplicates the chip.
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { label, shortcut, className, ...props },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-ink-faint">
        <Icon name="search" className="size-4" />
      </span>

      <input
        ref={ref}
        type="search"
        aria-label={label}
        className={cn(
          'block h-11 w-full rounded-field border border-line bg-canvas ps-11',
          'text-start text-field text-ink',
          'transition-[border-color,box-shadow] duration-200 placeholder:text-ink-faint',
          'focus:border-primary-600 focus:shadow-ring',
          '[&::-webkit-search-decoration]:appearance-none [&::-webkit-search-cancel-button]:appearance-none',
          // The chip is desktop-only, so the room made for it is too.
          shortcut === undefined ? 'pe-4' : 'pe-4 md:pe-14',
        )}
        {...props}
      />

      {shortcut !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            // Hidden on a phone: there is no keyboard to press it with, in a field already short at
            // 390px.
            'pointer-events-none absolute inset-y-0 end-0 hidden items-center pe-3 md:flex',
            'text-ink-faint',
          )}
        >
          {/* A fixed 20px box with the glyph centred: `py-0.5` on `leading-none` gave a 13px line to
              a slash that inks 16px, so it overflowed its own chip. */}
          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-chip border border-line bg-sunken px-1.5 font-sans text-label leading-none">
            {shortcut}
          </kbd>
        </span>
      )}
    </div>
  );
});
