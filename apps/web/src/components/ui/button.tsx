import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  isLoading?: boolean | undefined;
  icon?: ReactNode | undefined;
  // `end` is for an icon that is a direction rather than a classifier: a forward chevron before the
  // label points back at the word it is leading away from.
  iconPosition?: 'start' | 'end' | undefined;
}

// The primary blue is the only filled blue on a page, which is what makes "the thing to do here"
// answerable at a glance; `secondary` is the reference's outlined `.btn-ghost`, and `ghost` its
// soft-tinted `.kpi-action`. Filled variants lighten on hover rather than stepping down the scale,
// which is how the reference draws every one of them.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-ink-inverse hover:brightness-[1.06] active:brightness-[0.95]',
  secondary: 'border border-line bg-surface text-ink hover:bg-primary-100 hover:text-primary-700',
  ghost: 'bg-primary-100 text-primary-700 hover:brightness-[0.96] active:brightness-[0.92]',
  // No fill at rest: a column of ten rows must not read as ten calls to action.
  quiet: 'text-ink-muted hover:bg-inset hover:text-ink',
  danger: 'bg-danger-600 text-ink-inverse hover:brightness-[1.06] active:brightness-[0.95]',
};

// The two scale tokens and nothing else. A compact button is the tall one below `lg`, because a
// thumb does not shrink with the viewport; `min-w` matches, so an icon-only button stays square.
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-(--control-h) min-w-(--control-h) gap-2 px-3 text-nav lg:h-(--control-h-sm) lg:min-h-0 lg:min-w-(--control-h-sm)',
  md: 'h-(--control-h) min-w-(--control-h) gap-2 px-3.5 text-field',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'start',
  className,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={cn(
        // A softly rounded rectangle, not a pill: it sits beside fields and
        // cards of the same 8-14px family instead of on top of them.
        'pill-text cursor-pointer justify-center rounded-control font-medium',
        'transition-[filter,background-color,color,transform] duration-150 ease-out',
        'active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
        // A disabled button must not still look like it responds.
        'disabled:active:scale-100 disabled:hover:brightness-100 disabled:hover:bg-inherit',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled === true || isLoading}
      {...props}
    >
      {/* The spinner takes the icon's place: a button whose chevron trails its label must not have
          the label jump sideways when it starts working. */}
      {isLoading && iconPosition === 'start' && <Spinner />}
      {!isLoading && iconPosition === 'start' && icon}
      {children}
      {isLoading && iconPosition === 'end' && <Spinner />}
      {!isLoading && iconPosition === 'end' && icon}
    </button>
  );
}

function Spinner(): JSX.Element {
  return <Icon name="spinner" className="animate-spin" />;
}
