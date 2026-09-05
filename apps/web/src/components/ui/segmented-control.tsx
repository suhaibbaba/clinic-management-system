import type { JSX } from 'react';

import { cn } from '@web/lib/cn';

export interface SegmentOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  /** Shown as a small count beside the label, e.g. how many rows match. */
  readonly count?: number | undefined;
}

export interface SegmentedControlProps<TValue extends string> {
  readonly options: readonly SegmentOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  /** Names the whole group, e.g. "filter by status". */
  readonly label: string;
  readonly className?: string | undefined;
}

/**
 * Pill tabs for filtering a list — all / active / done, and the like.
 *
 * A radio group rather than tabs or buttons: these choose *which rows to
 * show*, they do not switch panels, and a radio group is what conveys "one of
 * these, and exactly one" to a screen reader. Arrow keys then move the
 * selection natively, in the reading direction, with no key handling here.
 *
 * The selected pill is white on the sunken track with a soft shadow — the same
 * "floating" idea as a card, one size down. It is deliberately *not* a blue
 * fill: a row of filters is chrome, and colouring the active one would give a
 * filter more weight than the data it filters.
 */
export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<TValue>): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-1 rounded-pill bg-sunken p-1',
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-pill px-3.5 py-1.5',
              'text-label font-medium',
              'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-95',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
              isSelected
                ? 'bg-surface text-ink shadow-pill'
                : 'text-ink-muted hover:bg-surface/60 hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded-pill px-1.5 text-label tabular-nums',
                  isSelected ? 'bg-primary-50 text-primary-700' : 'text-ink-subtle',
                )}
                dir="ltr"
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
