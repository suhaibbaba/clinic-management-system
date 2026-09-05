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
 * The primary action is near-black, not blue.
 *
 * Blue is doing a lot of work in this design already — progress bars, active
 * nav, selection tints — and a blue button in among them reads as one more
 * selected thing rather than as the one action on the page. Near-black has no
 * such competition, so "save" is unmistakable wherever it appears.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-neutral-900 text-ink-inverse shadow-pill hover:bg-neutral-800 active:bg-neutral-900',
  secondary:
    'bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-inset active:bg-sunken',
  ghost: 'bg-transparent text-ink-muted hover:bg-inset hover:text-ink active:bg-sunken',
  danger: 'bg-danger-600 text-ink-inverse shadow-pill hover:bg-danger-700 active:bg-danger-800',
};

const SIZES: Record<ButtonSize, string> = {
  // 8px icon gap at both sizes — an icon and its label are one object.
  sm: 'h-9 px-3.5 text-label gap-2',
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
        'inline-flex cursor-pointer items-center justify-center rounded-control font-medium',
        // One duration for every colour, shadow and transform change in the
        // app; `active:scale-[0.98]` is the press, small enough to feel like
        // the button gives rather than like the layout moved.
        'transition-[background-color,box-shadow,transform,color] duration-150 ease-out',
        'active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
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
