import { Children, type JSX, type ReactNode } from 'react';

import { Badge } from '@ui/components/badge';
import { Icon, type IconName } from '@ui/components/icon';

import { cn } from '@ui/lib/cn';
import { Ltr } from '@ui/components/ltr';

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
export type DeltaDirection = 'up' | 'down';

// The figure takes the tone, as the reference's `.kpi.late` and `.kpi.pending` do: the label chip
// stays the same barely-there wash on every card so the row reads as one thing.
const FIGURES: Record<StatTone, string> = {
  primary: 'text-ink',
  success: 'text-success-900',
  warning: 'text-warning-700',
  danger: 'text-danger-600',
  neutral: 'text-ink',
};

export interface StatCardProps {
  readonly label: string;
  /** Already formatted — this component never formats money or dates. */
  readonly value: ReactNode;
  readonly icon: IconName;
  readonly tone?: StatTone | undefined;
  readonly caption?: string | undefined;
  readonly delta?:
    | {
        readonly text: string;
        readonly direction: DeltaDirection;
        /** Whether this direction is good news — falling debt is `true`. */
        readonly isGood: boolean;
      }
    | undefined;
  readonly className?: string | undefined;
}

// `tabular-nums`, or a KPI row's digits shift width as data refreshes. Values arrive pre-formatted
// because money is a decimal string that must not pass through a float.
export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  caption,
  delta,
  className,
}: StatCardProps): JSX.Element {
  return (
    <div
      data-part="stat-card"
      className={cn(
        'rounded-card border border-line bg-surface p-[18px_20px] shadow-card',
        // `transition`, which is Tailwind's curated list: it carries `translate` and `scale` — the
        // properties a lift and a press actually move — along with the shadow and the colours.
        'transition duration-[250ms] ease-in-out hover:-translate-y-0.5 hover:shadow-card-hover',
        className,
      )}
    >
      {/* The icon and its label are one chip: the reference's `.tag`, a wash running from green
          into blue, naming what the figure below counts. */}
      <div className="flex min-h-[26px] items-center justify-between gap-2">
        <Badge tone="wash" icon={icon}>
          {label}
        </Badge>
      </div>

      <Ltr
        as="p"
        data-part="stat-card-figure"
        className={cn('mt-2 text-kpi font-medium', FIGURES[tone])}
      >
        {value}
      </Ltr>

      {(caption !== undefined || delta !== undefined) && (
        <div className="mt-[7px] flex flex-wrap items-center gap-x-2">
          {delta !== undefined && (
            <span
              data-part="stat-card-delta"
              className={cn(
                'pill-text inline-flex items-center gap-1 text-meta font-medium',
                delta.isGood ? 'text-success-700' : 'text-danger-700',
              )}
            >
              <Icon
                name={delta.direction === 'up' ? 'trend-up' : 'trend-down'}
                className="size-3.5"
              />
              {delta.text}
            </span>
          )}
          {caption !== undefined && (
            <span
              data-part="stat-card-caption"
              className="min-w-0 line-clamp-2 text-meta text-ink-subtle"
            >
              {caption}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Written out because Tailwind reads class names as literal strings — `xl:grid-cols-${n}` is never
// generated.
const WIDE_COLUMNS: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
};

export function StatRow({
  children,
  cards,
}: {
  readonly children: ReactNode;
  readonly cards?: number | undefined;
}): JSX.Element {
  const count = cards ?? Children.count(children);

  return (
    <div
      data-part="stat-row"
      className={cn('mb-5 grid grid-cols-2 gap-3', WIDE_COLUMNS[count] ?? 'xl:grid-cols-4')}
    >
      {children}
    </div>
  );
}
