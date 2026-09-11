import type { HTMLAttributes, JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export type CardTone = 'default' | 'selected';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly tone?: CardTone | undefined;
  /** Drops the built-in padding for cards that manage their own (tables). */
  readonly flush?: boolean | undefined;
  // Marks the card as something you click — without it every card looks clickable and none reads as
  // such.
  readonly interactive?: boolean | undefined;
  readonly children: ReactNode;
}

// The selected edge is an `outline`, not a `border`: an outline takes no part in layout, so
// selecting a card does not nudge every neighbour.
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
        // A drawn hairline plus a soft blue-tinted shadow, as the reference draws every panel: the
        // shadow alone leaves the card's edge undefined against the tinted ground.
        'rounded-card border border-line bg-surface shadow-card',
        'transition-[box-shadow,background-color,border-color,transform] duration-200',
        !flush && 'p-[18px_20px]',
        interactive && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover',
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

export function CardHeader({ title, subtitle, actions, className }: CardHeaderProps): JSX.Element {
  return (
    <div className={cn('mb-3 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-section font-medium text-ink">{title}</h2>
        {subtitle !== undefined && <p className="mt-0.5 text-meta text-ink-muted">{subtitle}</p>}
      </div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
