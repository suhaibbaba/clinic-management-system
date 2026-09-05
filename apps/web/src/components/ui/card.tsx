import type { HTMLAttributes, JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export type CardTone = 'default' | 'selected';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * `selected` is the whole design's selection state: a soft primary tint and
   * a 1.5px primary edge, used for a chosen row, a picked tooth, an active
   * filter target — anywhere the answer to "which one" has to be obvious
   * without a checkbox.
   */
  readonly tone?: CardTone | undefined;
  /** Drops the built-in padding for cards that manage their own (tables). */
  readonly flush?: boolean | undefined;
  /**
   * Marks the card as something you click. It then lifts to `shadow-float` on
   * hover and takes a pointer — an affordance a plain card must not have, or
   * every card on the page looks clickable and none of them reads as such.
   */
  readonly interactive?: boolean | undefined;
  readonly children: ReactNode;
}

/**
 * The surface everything sits on.
 *
 * Content in this app never touches the page ground directly: the ground is a
 * tinted wash and cards are the white paper floating on it. That is the whole
 * visual system in one component, so `bg-surface rounded-card shadow-card`
 * should appear here and nowhere else.
 *
 * The selected border is drawn with `outline`, not `border`: an outline does
 * not take part in layout, so a card does not shift by 1.5px when it becomes
 * selected — which, in a grid of them, would nudge every neighbour.
 */
export function Card({
  tone = 'default',
  flush = false,
  interactive = false,
  className,
  children,
  ...props
}: CardProps): JSX.Element {
  return (
    <div
      className={cn(
        // Border *and* shadow: on an off-white ground the shadow alone leaves
        // a card's edge ambiguous where it falls across something the same
        // lightness as itself.
        'rounded-card border border-line-card bg-surface shadow-card',
        'transition-[box-shadow,background-color,border-color] duration-150',
        !flush && 'p-5',
        interactive &&
          'cursor-pointer hover:border-primary-200 hover:shadow-float focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
        tone === 'selected' &&
          'bg-selected outline-[1.5px] -outline-offset-[1.5px] outline-selected-line',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode | undefined;
  readonly actions?: ReactNode | undefined;
  readonly className?: string | undefined;
}

/** Title, optional subtitle, optional actions — the top of most cards. */
export function CardHeader({ title, subtitle, actions, className }: CardHeaderProps): JSX.Element {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-value font-semibold text-ink">{title}</h2>
        {subtitle !== undefined && <p className="mt-0.5 text-label text-ink-muted">{subtitle}</p>}
      </div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
