import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export type RowActionTone = 'primary' | 'quiet';

export interface RowActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading icon, 16px — pass an `<Icon>`; it is sized here. */
  readonly icon?: ReactNode | undefined;
  /**
   * `primary` is the row's one blue action. `quiet` is grey until hovered, for
   * the second and third actions on a row that has more than one.
   */
  readonly tone?: RowActionTone | undefined;
  readonly children: ReactNode;
}

const TONES: Record<RowActionTone, string> = {
  primary: 'text-primary-600 hover:text-primary-700',
  quiet: 'text-ink-muted hover:text-ink',
};

/**
 * A row's action, as text rather than as a button.
 *
 * A table of ten rows with two filled pills each is twenty pills, and the page
 * stops having a primary action at all. The design language answers that with
 * blue text in the last column — the patients list already did it by hand, and
 * this is that recipe with a name so users and doctors read the same.
 *
 * `whitespace-nowrap` is not cosmetic: "Reset password" in a column sized to
 * the shortest label wrapped to two lines and dragged its icon along with it,
 * which is what a row action must never do.
 */
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
        'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap',
        'rounded-control px-1 py-0.5 text-value font-medium',
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
