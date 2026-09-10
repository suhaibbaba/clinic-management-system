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

      {/*
        24px, at every width.

        The figure used to be 32 and had to step down on a phone: `200.00 USD`
        at that size is 170px wide and never breaks — an amount is one word —
        and two cards across a 390px screen leave about 133px of card, so it
        either wrapped, stranding the currency on a second line, or pushed the
        page sideways. At 24 a five-figure balance with its symbol fits in that
        space, and it is still the largest thing on the card.
      */}
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

/**
 * How many columns a row of `n` cards opens into on a wide screen.
 *
 * Written out rather than interpolated because Tailwind reads class names as
 * literal strings — `xl:grid-cols-${n}` is a class that is never generated.
 *
 * Five is the widest this goes. Beyond that the row wraps at four, which is
 * two full rows for six and the only shape that does not put a 150px card on
 * a laptop.
 */
const WIDE_COLUMNS: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
};

/**
 * The KPI row: the page's stat cards on one line, collapsing to two up.
 *
 * A named component rather than a utility class repeated on every page, so a
 * KPI row is the same shape everywhere it appears.
 *
 * The column count comes from the number of cards rather than being fixed at
 * four. It was four, and the pages that summarise themselves in three or five
 * — the dashboard, the appointments day — left a card-shaped hole at the end
 * of the row, or dropped a single card onto a second line under four others
 * with nothing beside it. Five open all the way at `xl`, which leaves about
 * 145px of card: enough for a five-figure balance and its symbol now the
 * figure is 24px rather than 32.
 */
export function StatRow({ children }: { readonly children: ReactNode }): JSX.Element {
  // Two up on a phone. Four full-width cards is 1300px of scrolling before
  // the data they summarise, which inverts what a summary is for.
  const count = Children.count(children);

  return (
    <div className={cn('mb-5 grid grid-cols-2 gap-3', WIDE_COLUMNS[count] ?? 'xl:grid-cols-4')}>
      {children}
    </div>
  );
}
