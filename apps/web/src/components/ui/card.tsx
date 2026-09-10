import type { HTMLAttributes, JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export type CardTone = 'default' | 'selected';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * `selected` is the whole design's selection state: a soft primary tint and
   * a primary edge, used for a chosen row, a picked tooth, an active filter
   * target — anywhere the answer to "which one" has to be obvious without a
   * checkbox.
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
 * tinted wash and cards are the white panels drawn on it. That is the whole
 * visual system in one component, so `bg-surface rounded-card shadow-card`
 * should appear here and nowhere else.
 *
 * The selected border is drawn with `outline`, not `border`: an outline does
 * not take part in layout, so a card does not shift by a pixel when it becomes
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
        // The edge is the card. `shadow-card` is a hairline ring plus almost
        // no blur (theme.css) rather than a border, so a card that becomes
        // selected or interactive changes colour without changing size.
        'rounded-card bg-surface shadow-card',
        'transition-[box-shadow,background-color,border-color] duration-150',
        !flush && 'p-4',
        interactive && 'cursor-pointer hover:shadow-float',
        tone === 'selected' && 'bg-selected outline outline-offset-[-1px] outline-selected-line',
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
    <div className={cn('mb-3 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-section font-semibold text-ink">{title}</h2>
        {subtitle !== undefined && <p className="mt-0.5 text-meta text-ink-muted">{subtitle}</p>}
      </div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
