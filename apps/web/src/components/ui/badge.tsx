import type { JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/**
 * A status badge: soft tinted ground, a dot, and text in the same family.
 *
 * Never a solid fill. A solid badge competes with the primary action for the
 * eye, and a grid of entity cards is mostly badges — a row of saturated pills
 * turns a calm page into a warning light. The dot is what carries the tone at
 * a glance; the tint only supports it.
 *
 * The dot is decorative, so the badge's own text is the whole accessible name:
 * a tone is never the only way to know what a badge says.
 */
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
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-label font-medium',
        style.pill,
        className,
      )}
    >
      {!plain && <span aria-hidden="true" className={cn('size-1.5 rounded-pill', style.dot)} />}
      {children}
    </span>
  );
}
