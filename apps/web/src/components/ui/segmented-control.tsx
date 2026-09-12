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
      className={cn('inline-flex max-w-full flex-wrap items-center gap-2', className)}
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
              'rounded-pill border px-3.5 lg:h-[30px] lg:min-h-0 lg:min-w-0',
              'text-meta font-medium transition-[background-color,border-color,color] duration-150',
              isSelected
                ? 'border-primary-600 bg-primary-600 text-ink-inverse'
                : 'border-line bg-surface text-ink-muted hover:border-primary-200 hover:bg-primary-100 hover:text-primary-700',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <Ltr
                className={cn(
                  // A tinted pill, not a bare digit: the count is what the filter would leave, and
                  // the reference gives it the same red a balance owed gets.
                  // The box is declared and the digit centred in it, as the rail's badge does it.
                  // Padding a line-height token instead gave a 17px circle around 11px of ink, so
                  // the figure read as floating rather than set.
                  'inline-flex h-[13px] items-center justify-center',
                  'rounded-pill px-[7px] text-micro leading-[1.2] tabular-nums',
                  isSelected
                    ? 'bg-primary-900/25 text-ink-inverse'
                    : 'bg-danger-100 text-danger-600',
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
