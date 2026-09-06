import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  /** Renders a spinner and blocks interaction while a mutation is running. */
  isLoading?: boolean | undefined;
  icon?: ReactNode | undefined;
}

/*
 * One action colour.
 *
 * The primary button is the blue, and it is the only filled blue on a page —
 * which is what makes "the thing to do here" answerable at a glance. A
 * secondary is a plain grey pill, a ghost is blue text, and danger is the red
 * kept for destructive acts. Nothing else fills with a colour.
 *
 * A previous revision made the primary near-black to keep it out of the blue's
 * way. With a single accent that reasoning inverts: near-black would now be
 * the one colour on the page that means nothing.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-ink-inverse hover:bg-primary-700 active:bg-primary-800',
  secondary: 'bg-inset text-ink hover:bg-sunken active:bg-neutral-300',
  ghost: 'bg-transparent text-primary-600 hover:bg-primary-50 active:bg-primary-100',
  danger: 'bg-danger-600 text-ink-inverse hover:bg-danger-700 active:bg-danger-800',
};

const SIZES: Record<ButtonSize, string> = {
  // 8px icon gap at both sizes — an icon and its label are one object.
  sm: 'h-8 px-3.5 text-label gap-2',
  md: 'h-10 px-5 text-value gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
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
        // Fully rounded: the pill is the button shape in this system.
        'inline-flex cursor-pointer items-center justify-center rounded-pill font-medium',
        // One duration for every colour, shadow and transform change in the
        // app; `active:scale-[0.98]` is the press, small enough to feel like
        // the button gives rather than like the layout moved.
        'transition-[background-color,box-shadow,transform,color] duration-150 ease-out',
        'active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
        // A disabled button must not still look like it responds.
        'disabled:active:scale-100 disabled:hover:bg-inherit',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled === true || isLoading}
      {...props}
    >
      {isLoading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

/** The loading state of a submit button: lucide's spinner, spun. */
function Spinner(): JSX.Element {
  return <Icon name="spinner" className="animate-spin" />;
}
