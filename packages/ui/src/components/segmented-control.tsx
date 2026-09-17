import type { JSX } from "react";

import { PILL_BASE } from "@ui/components/badge";
import { cn } from "@ui/lib/cn";
import { Ltr } from "@ui/components/ltr";

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

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<TValue>): JSX.Element {
  return (
    <div
      data-part="segmented-control"
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex max-w-full flex-wrap items-center gap-2", className)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            data-part="segment"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              PILL_BASE,
              "min-h-(--control-h) min-w-(--control-h) cursor-pointer border-[1.5px]",
              "lg:h-(--control-h-sm) lg:min-h-0 lg:min-w-(--control-h-sm)",
              "transition-[background-color,border-color,color] duration-[250ms] ease-in-out",
              isSelected
                ? "border-primary-600 bg-primary-600 text-ink-inverse"
                : "border-line-strong bg-surface text-ink-muted hover:bg-inset hover:border-neutral-400 hover:text-ink",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <Ltr
                data-part="segment-count"
                className={cn(
                  "pill-text inline-flex items-center h-4 min-w-4 justify-center",
                  "rounded-pill px-[7px] text-micro font-medium tabular-nums",
                  isSelected
                    ? "bg-primary-900/25 text-ink-inverse"
                    : "bg-danger-100 text-danger-600",
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
