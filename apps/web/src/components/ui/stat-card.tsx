import type { JSX, ReactNode } from 'react';

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

      {/*
        The figure steps down until there is room for it.

        `200.00 USD` at 32px is 170px wide and never breaks — an amount is one
        word. Two cards across a phone leave about 133px of card, and at 32px
        the figure either wrapped — currency stranded on a second line — or,
        once it stopped wrapping, pushed the whole page sideways. 20px holds a
        five-figure balance with its currency in that space; the full size
        arrives at `lg`, where a card is 236px wide. It is still the largest
        thing on the card, which is what the size was for.
      */}
      <Ltr as="p" className="mt-4 text-[1.25rem] font-semibold text-ink lg:text-kpi">
        {value}
      </Ltr>

      {(caption !== undefined || delta !== undefined) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2">
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
          {caption !== undefined && (
            <span className="min-w-0 line-clamp-2 text-label text-ink-subtle">{caption}</span>
          )}
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
  // Two up on a phone. Four full-width cards is 1300px of scrolling before
  // the data they summarise, which inverts what a summary is for.
  return <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{children}</div>;
}
