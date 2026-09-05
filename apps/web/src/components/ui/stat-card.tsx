import type { JSX, ReactNode } from 'react';

import { Icon, type IconName } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

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
  /** Small line under the number: a comparison, a total, a qualifier. */
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

/**
 * One number, stated plainly: icon chip and label on top, the figure large
 * underneath, a caption or delta below that.
 *
 * The number is the point, so it gets the size and `tabular-nums` — a KPI row
 * whose digits shift width as the data refreshes looks broken. Values arrive
 * pre-formatted because money in this system is a decimal string that must not
 * pass through a float, and a display component is the wrong place to know
 * that.
 *
 * A delta's colour comes from `isGood`, not from its arrow: overdue balances
 * falling is green while pointing down, and treating "up" as good would paint
 * a growing debt in the colour of success.
 */
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
    <div className={cn('rounded-card bg-surface p-5 shadow-card', className)}>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-panel',
            CHIPS[tone],
          )}
        >
          <Icon name={icon} className="size-[18px]" />
        </span>
        <span className="text-label font-medium text-ink-muted">{label}</span>
      </div>

      <p className="mt-4 text-kpi font-semibold tabular-nums text-ink" dir="ltr">
        {value}
      </p>

      {(caption !== undefined || delta !== undefined) && (
        <div className="mt-1.5 flex items-center gap-2">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-label font-medium',
                delta.isGood ? 'text-success-700' : 'text-danger-700',
              )}
            >
              <Icon
                name={delta.direction === 'up' ? 'trend-up' : 'trend-down'}
                className="size-4"
              />
              {delta.text}
            </span>
          )}
          {caption !== undefined && <span className="text-label text-ink-subtle">{caption}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * The KPI row: four stat cards that collapse to two, then one.
 *
 * A named component rather than a utility class repeated on every page, so a
 * KPI row is the same shape everywhere it appears.
 */
export function StatRow({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
