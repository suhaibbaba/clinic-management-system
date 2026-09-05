import type { JSX } from 'react';

import { cn } from '@web/lib/cn';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger';

const TONES: Record<ProgressTone, string> = {
  primary: 'bg-primary-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
};

export interface ProgressBarProps {
  /** Completed units. Clamped into `0…total`, so a bad count cannot overflow. */
  readonly value: number;
  readonly total: number;
  /** What the bar measures, for screen readers. Required — a bare bar says nothing. */
  readonly label: string;
  readonly tone?: ProgressTone | undefined;
  readonly className?: string | undefined;
}

/**
 * A thin rounded progress bar.
 *
 * The one place blue is used as a fill: progress is the app saying "this much
 * of the work is done", which is exactly the structural, non-alarming meaning
 * the primary carries. A tone is passed only when the bar means something
 * else — stock below its minimum is `danger` because it is a problem, not
 * because it is a small number.
 *
 * It is a `progressbar` with its real numbers attached rather than a styled
 * div: the percentage is a visual convenience, and a screen reader should get
 * "3 of 8", not "37%".
 */
export function ProgressBar({
  value,
  total,
  label,
  tone = 'primary',
  className,
}: ProgressBarProps): JSX.Element {
  const safeTotal = Math.max(total, 0);
  const done = Math.min(Math.max(value, 0), safeTotal);
  const percent = safeTotal === 0 ? 0 : (done / safeTotal) * 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      className={cn('h-1.5 w-full overflow-hidden rounded-pill bg-sunken', className)}
    >
      {/*
        Width is the only inline style here: it is a computed length, not a
        colour, and there is no utility class for an arbitrary percentage.
      */}
      <div
        className={cn('h-full rounded-pill transition-[width] duration-500', TONES[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
