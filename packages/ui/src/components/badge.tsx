import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

import { Icon, type IconName } from '@ui/components/icon';
import { cn } from '@ui/lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** The label chip that names what a figure counts — the reference's `.tag`, never a status. */
export type BadgeVariant = BadgeTone | 'wash';

// Never a solid fill: a grid of entity cards is mostly badges, and a row of saturated pills turns a
// calm page into a warning light. The dot is `currentColor`, as the reference draws it — one
// declaration per tone instead of two that can disagree.
const TONES: Record<BadgeVariant, string> = {
  neutral: 'bg-sunken text-ink-muted',
  success: 'bg-success-100 text-success-900',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-600',
  info: 'bg-primary-100 text-primary-600',
  // The reference's `.tag`: the label that names what a KPI figure counts, or what a panel lists.
  wash: 'tag-wash text-primary-900',
};

/** One pill for the whole app: a status, a count, a filter — the same box in every one of them. */
export const PILL_BASE = cn(
  'pill-text h-(--control-h-sm) gap-2 whitespace-nowrap rounded-pill px-3',
  'text-nav font-medium',
);

export interface BadgeProps {
  readonly tone?: BadgeVariant | undefined;
  /** Drops the dot where the badge is already inside a coloured context, or leads with an icon. */
  readonly plain?: boolean | undefined;
  readonly icon?: IconName | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function Badge({
  tone = 'neutral',
  plain = false,
  icon,
  className,
  children,
}: BadgeProps): JSX.Element {
  return (
    <span data-part="badge" className={cn(PILL_BASE, 'min-w-0', TONES[tone], className)}>
      {icon !== undefined && <Icon name={icon} className="size-3.5 shrink-0" />}
      {!plain && icon === undefined && (
        <span
          data-part="badge-dot"
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-pill bg-current"
        />
      )}
      <span data-part="badge-label" className="min-w-0 truncate">
        {children}
      </span>
    </span>
  );
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly selected?: boolean | undefined;
  readonly children: ReactNode;
}

// The same pill as a control, so it takes the fields' state language rather than a second one:
// bordered at rest, primary-tinted when it is the one chosen, a solid fill when it is unavailable.
// The tall token, not the small one: a chip lives in a filter row beside a search box and a select,
// and a row of controls whose heights disagree reads as a mistake at any width.
export function Chip({
  selected = false,
  className,
  children,
  type = 'button',
  ...props
}: ChipProps): JSX.Element {
  const disabled = props.disabled === true;

  return (
    <button
      type={type}
      data-part="chip"
      aria-pressed={selected}
      className={cn(
        PILL_BASE,
        'h-(--control-h) shrink-0 cursor-pointer border-[1.5px]',
        'transition-[background-color,border-color,color] duration-150',
        disabled && 'cursor-not-allowed border-transparent bg-inset text-ink-faint',
        !disabled &&
          (selected
            ? 'border-primary-600 bg-primary-100 text-primary-700'
            : 'border-line-strong bg-surface text-ink-muted hover:border-neutral-400 hover:text-ink'),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
