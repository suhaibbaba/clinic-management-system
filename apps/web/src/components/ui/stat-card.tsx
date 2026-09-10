import { Children, type JSX, type ReactNode } from 'react';

import { Icon, type IconName } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';
import { Ltr } from '@web/components/ui/ltr';

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
export type DeltaDirection = 'up' | 'down';

const CHIPS: Record<StatTone, string> = {
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  neutral: 'bg-sunken text-ink-muted',
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
    <div className={cn('rounded-card bg-surface p-4 shadow-card', className)}>
      {/* The icon and its label are one line: a tinted square, then the words,
          then nothing — the figure below is what the card is for. */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex size-7 shrink-0 items-center justify-center rounded-control',
            CHIPS[tone],
          )}
        >
          <Icon name={icon} className="size-4" />
        </span>
        <span className="min-w-0 truncate text-meta font-medium text-ink-muted">{label}</span>
      </div>

      {/* 24 rather than 32: an amount is one word, and at 32 `200.00 USD` is 170px inside a 133px
          card — it wrapped or pushed the page sideways. */}
      <Ltr as="p" className="mt-2.5 text-kpi font-semibold text-ink">
        {value}
      </Ltr>

      {(caption !== undefined || delta !== undefined) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-meta font-medium',
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
            <span className="min-w-0 line-clamp-2 text-meta text-ink-subtle">{caption}</span>
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
  // Two up on a phone. Four full-width cards is 1300px of scrolling before
  // the data they summarise, which inverts what a summary is for.
  const count = cards ?? Children.count(children);

  return (
    <div className={cn('mb-5 grid grid-cols-2 gap-3', WIDE_COLUMNS[count] ?? 'xl:grid-cols-4')}>
      {children}
    </div>
  );
}
