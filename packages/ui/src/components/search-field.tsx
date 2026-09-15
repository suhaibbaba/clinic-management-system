import { forwardRef, type InputHTMLAttributes } from 'react';

import { FIELD_TEXT, FieldClear, FieldIcon, fieldShell } from '@ui/components/field';
import { cn } from '@ui/lib/cn';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Names the field for screen readers; there is no visible label. */
  readonly label: string;
  readonly shortcut?: string | undefined;
  readonly onClear?: (() => void) | undefined;
  readonly clearLabel?: string | undefined;
}

// `type="search"` for the platform's clear button; its WebKit decoration is stripped because it
// lands on the wrong side in RTL and duplicates the button beside it.
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { label, shortcut, className, onClear, clearLabel, ...props },
  ref,
) {
  const clearable = onClear !== undefined && String(props.value ?? '') !== '';

  return (
    <div data-part="search-field" className={cn(fieldShell({}), className)}>
      <FieldIcon name="search" />

      <input
        ref={ref}
        data-part="search-field-control"
        type="search"
        aria-label={label}
        className={cn(
          FIELD_TEXT,
          'page-rtl:text-right page-ltr:text-left',
          '[&::-webkit-search-decoration]:appearance-none [&::-webkit-search-cancel-button]:appearance-none',
        )}
        {...props}
      />

      {clearable && clearLabel !== undefined && <FieldClear label={clearLabel} onClear={onClear} />}

      {shortcut !== undefined && (
        <kbd
          data-part="search-field-shortcut"
          aria-hidden="true"
          className={cn(
            'pill-text inline-flex items-center hidden h-5 min-w-5 shrink-0 justify-center rounded-chip md:inline-flex',
            'border border-line bg-sunken px-1.5 font-sans text-label text-ink-faint',
          )}
        >
          {shortcut}
        </kbd>
      )}
    </div>
  );
});
