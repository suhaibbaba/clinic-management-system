import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

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
  primary:
    'bg-neutral-900 text-ink-inverse shadow-pill hover:bg-neutral-800 focus-visible:outline-neutral-900',
  secondary:
    'bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-sunken focus-visible:outline-ink-muted',
  ghost:
    'bg-transparent text-ink-muted hover:bg-sunken hover:text-ink focus-visible:outline-ink-subtle',
  danger:
    'bg-danger-600 text-ink-inverse shadow-pill hover:bg-danger-700 focus-visible:outline-danger-600',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-label gap-1.5',
  md: 'h-11 px-5 text-value gap-2',
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
        'inline-flex items-center justify-center rounded-control font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
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

function Spinner(): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
