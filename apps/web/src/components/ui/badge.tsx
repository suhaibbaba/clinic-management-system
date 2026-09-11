import type { JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

// Never a solid fill: a grid of entity cards is mostly badges, and a row of saturated pills turns a
// calm page into a warning light. The dot is `currentColor`, as the reference draws it — one
// declaration per tone instead of two that can disagree.
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-ink-subtle',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-600',
  info: 'bg-primary-100 text-primary-600',
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
  return (
    <span
      className={cn(
        // A badge never breaks across lines: a wrapped pill centres its dot against two lines and
        // doubles the row height. The cell is inside `overflow-x-auto` already.
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-[5px]',
        'text-meta font-medium',
        TONES[tone],
        className,
      )}
    >
      {!plain && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-pill bg-current" />}
      {children}
    </span>
  );
}
