import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export type RowActionTone = 'primary' | 'quiet';

export interface RowActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly icon?: ReactNode | undefined;
  readonly tone?: RowActionTone | undefined;
  readonly children: ReactNode;
}

// The reference's `.open-btn`: a soft blue fill rather than a saturated one, so ten rows of them
// still read as ten rows rather than as ten calls to action.
const TONES: Record<RowActionTone, string> = {
  primary: 'bg-primary-100 text-primary-700 hover:brightness-[0.96]',
  quiet: 'text-ink-muted hover:bg-inset hover:text-ink',
};

// `whitespace-nowrap`, or a long label wraps and drags its icon along.
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
        'min-h-11 min-w-11 rounded-chip px-[13px] py-2 text-meta font-medium',
        'lg:min-h-0 lg:min-w-0',
        'transition-[background-color,color,filter] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon !== undefined && <span className="[&>svg]:size-3.5">{icon}</span>}
      {children}
    </button>
  );
}
