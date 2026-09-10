import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export type RowActionTone = 'primary' | 'quiet';

export interface RowActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly icon?: ReactNode | undefined;
  readonly tone?: RowActionTone | undefined;
  readonly children: ReactNode;
}

const TONES: Record<RowActionTone, string> = {
  primary: 'text-primary-600 hover:text-primary-700',
  quiet: 'text-ink-muted hover:text-ink',
};

// Text rather than a button: ten rows with two filled pills each is twenty pills and no primary
// action. `whitespace-nowrap`, or a long label wraps and drags its icon along.
export function RowAction({
  icon,
  tone = 'primary',
  className,
  children,
  type = 'button',
  ...props
}: RowActionProps): JSX.Element {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap',
        // Square on touch: a two-syllable Arabic label inside `px-1` drew a 38px-wide target that
        // was the full 44 tall.
        'min-h-11 min-w-11 rounded-control px-1 py-0.5 text-value font-medium',
        'lg:min-h-0 lg:min-w-0',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon !== undefined && <span className="[&>svg]:size-4">{icon}</span>}
      {children}
    </button>
  );
}
