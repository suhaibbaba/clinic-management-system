import type { JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

// Never a solid fill: a grid of entity cards is mostly badges, and a row of saturated pills turns a
// calm page into a warning light.
const TONES: Record<BadgeTone, { readonly pill: string; readonly dot: string }> = {
  neutral: { pill: 'bg-sunken text-ink-muted', dot: 'bg-neutral-500' },
  success: { pill: 'bg-success-50 text-success-700', dot: 'bg-success-500' },
  warning: { pill: 'bg-warning-50 text-warning-700', dot: 'bg-warning-500' },
  danger: { pill: 'bg-danger-50 text-danger-700', dot: 'bg-danger-500' },
  info: { pill: 'bg-primary-50 text-primary-700', dot: 'bg-primary-500' },
};

export interface BadgeProps {
  readonly tone?: BadgeTone;
  /** Drops the dot where the badge is already inside a coloured context. */
  readonly plain?: boolean;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function Badge({
  tone = 'neutral',
  plain = false,
  className,
  children,
}: BadgeProps): JSX.Element {
  const style = TONES[tone];

  return (
    <span
      className={cn(
        // A badge never breaks across lines: a wrapped pill centres its dot against two lines and
        // doubles the row height. The cell is inside `overflow-x-auto` already.
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2 py-0.5',
        'text-meta font-medium',
        style.pill,
        className,
      )}
    >
      {!plain && (
        <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-pill', style.dot)} />
      )}
      {children}
    </span>
  );
}
