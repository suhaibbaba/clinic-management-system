import type { JSX } from "react";
import { cx } from "@web/booking/ui";

export function Dots({
  count,
  active,
  onSelect,
  label,
  itemLabel,
  duration,
  tone = "brand",
  className,
  "data-testid": testId,
}: {
  readonly count: number;
  readonly active: number;
  readonly onSelect: (index: number) => void;
  readonly label: string;
  readonly itemLabel: (index: number) => string;
  readonly duration?: number | undefined;
  readonly tone?: "brand" | "inverse";
  readonly className?: string;
  readonly "data-testid"?: string;
}): JSX.Element | null {
  if (count < 2) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className={cx("flex items-center", className)}
    >
      {Array.from({ length: count }, (_, index) => {
        const current = index === active;

        return (
          <button
            key={index}
            type="button"
            data-testid={testId && `${testId}-${index + 1}`}
            aria-label={itemLabel(index)}
            aria-current={current}
            onClick={() => onSelect(index)}
            className="group/dot inline-flex size-6 cursor-pointer items-center justify-center"
          >
            <span
              aria-hidden
              className={cx(
                "relative block h-2 overflow-hidden rounded-pill transition-[width,background-color] duration-500 ease-out",
                current
                  ? cx("w-7", tone === "inverse" ? "bg-ink-inverse/40" : "bg-primary-200")
                  : cx(
                      "w-2",
                      tone === "inverse"
                        ? "bg-ink-inverse/50 group-hover/dot:bg-ink-inverse/80"
                        : "bg-line-strong group-hover/dot:bg-primary-300",
                    ),
              )}
            >
              {current && (
                <span
                  key={`${index}-${active}`}
                  className={cx(
                    "absolute inset-y-0 start-0 rounded-pill",
                    tone === "inverse" ? "bg-ink-inverse" : "bg-primary-600",
                    duration ? "site-dot-fill" : "w-full",
                  )}
                  {...(duration && { style: { animationDuration: `${duration}ms` } })}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
