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
 * Styled as the platform's own segmented control: a grey groove with the
 * chosen segment raised out of it in white. Deliberately *not* a blue fill —
 * a row of filters is chrome, and colouring one would give a filter more
 * weight than the data it filters, in the one place the page has reserved for
 * its single action colour.
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
        'inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-control bg-inset p-0.5',
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
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] px-3.5',
              'text-label transition-[background-color,color,box-shadow] duration-150',
              isSelected
                ? 'bg-surface font-semibold text-ink shadow-pill'
                : 'font-medium text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'text-label tabular-nums',
                  isSelected ? 'text-ink-muted' : 'text-ink-subtle',
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
