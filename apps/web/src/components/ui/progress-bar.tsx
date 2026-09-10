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

// A real `progressbar` with its numbers attached, so a screen reader gets "3 of 8" rather than
// "37%". A tone is passed only when the bar means a problem.
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
      className={cn('h-1.5 w-full overflow-hidden rounded-pill bg-inset', className)}
    >
      {/* Width is the only inline style: a computed length, and there is no utility class for an
          arbitrary percentage. */}
      <div
        className={cn('h-full rounded-pill transition-[width] duration-500', TONES[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
