import type { JSX } from 'react';

import { cn } from '@web/lib/cn';
import { Ltr } from '@web/components/ui/ltr';

export interface SegmentOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly count?: number | undefined;
}

export interface SegmentedControlProps<TValue extends string> {
  readonly options: readonly SegmentOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly label: string;
  readonly className?: string | undefined;
}

// A radio group, not tabs: these choose which rows to show, and it conveys "exactly one" plus
// native arrow keys. Not a blue fill — a filter is chrome.
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
        'inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-control border border-line bg-inset p-0.5',
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
              // 44 in both directions on touch: `px-3.5` around a two-letter label drew a 43px-wide
              // segment.
              'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5',
              'rounded-control px-3 lg:h-8 lg:min-h-0 lg:min-w-0',
              'text-label transition-[background-color,color,box-shadow] duration-150',
              isSelected
                ? 'bg-surface font-semibold text-ink shadow-pill'
                : 'font-medium text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <Ltr
                className={cn(
                  'text-label tabular-nums',
                  isSelected ? 'text-ink-muted' : 'text-ink-subtle',
                )}
              >
                {option.count}
              </Ltr>
            )}
          </button>
        );
      })}
    </div>
  );
}
