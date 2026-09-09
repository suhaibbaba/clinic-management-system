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
  /**
   * Which side of the label the icon sits on, in reading order.
   *
   * `start` is the default and is right for almost everything: an icon that
   * *classifies* the action — a plus on "add patient", a printer on "print" —
   * belongs before the words, the way a bullet does.
   *
   * `end` is for the one case where the icon is not a classifier but a
   * *direction*: "next" carries a forward chevron, and a forward chevron drawn
   * before the label points back at the word it is leading away from. On the
   * pagination bar that put the two arrows nose to nose in the middle of the
   * control, both aiming inwards, with the page count between them.
   */
  iconPosition?: 'start' | 'end' | undefined;
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

/*
 * Heights are the drawn heights; `min-h-11` below `sm` is the touch target.
 *
 * A 32px pill is right on a desktop and too small for a thumb — WCAG 2.5.8
 * asks for 44. Rather than draw two sets of buttons, the phone keeps the same
 * pill inside a taller box: the fill grows with it, the type does not move,
 * and nothing about the design language changes.
 */
const SIZES: Record<ButtonSize, string> = {
  // 8px icon gap at both sizes — an icon and its label are one object.
  sm: 'min-h-11 px-3.5 text-label gap-2 lg:h-8 lg:min-h-0',
  md: 'min-h-11 px-5 text-value gap-2 lg:h-10 lg:min-h-0',
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
      {/*
        The spinner takes the icon's place wherever the icon was going to be:
        a button whose chevron trails its label must not have the label jump
        sideways the moment it starts working.
      */}
      {isLoading && iconPosition === 'start' && <Spinner />}
      {!isLoading && iconPosition === 'start' && icon}
      {children}
      {isLoading && iconPosition === 'end' && <Spinner />}
      {!isLoading && iconPosition === 'end' && icon}
    </button>
  );
}

/** The loading state of a submit button: lucide's spinner, spun. */
function Spinner(): JSX.Element {
  return <Icon name="spinner" className="animate-spin" />;
}
