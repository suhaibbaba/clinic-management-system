import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

import { Icon } from '@ui/components/icon';
import { cn } from '@ui/lib/cn';

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
// soft-tinted `.kpi-action`. Every one of them answers the pointer with a step of its own scale:
// the reference's `filter: brightness(1.06)` is nothing at all on a white ground, which is what
// left the outlined button signalling with its edge alone.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-ink-inverse hover:bg-primary-500 active:bg-primary-700',
  // A neutral step, not `primary-100`: that made it vanish on any card already painted that colour
  // — a confirmed appointment's ribbon tile is exactly that, so "جاء المريض" disappeared under the
  // pointer. The edge and the ink still turn primary with it.
  secondary:
    'border border-line bg-surface text-ink hover:bg-inset hover:border-primary-600 hover:text-primary-700 active:bg-neutral-200',
  ghost: 'bg-primary-100 text-primary-700 hover:bg-primary-200 active:bg-primary-300',
  // No fill at rest: a column of ten rows must not read as ten calls to action.
  quiet: 'text-ink-muted hover:bg-inset hover:text-ink active:bg-neutral-200',
  danger: 'bg-danger-600 text-ink-inverse hover:bg-danger-500 active:bg-danger-700',
};

// The two scale tokens and nothing else. A compact button is the tall one below `lg`, because a
// thumb does not shrink with the viewport; `min-w` matches, so an icon-only button stays square.
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-(--control-h) min-w-(--control-h) gap-2 px-3 text-nav lg:h-(--control-h-sm) lg:min-h-0 lg:min-w-(--control-h-sm)',
  // `text-nav`, not `text-field`: this is a label, and 16px is reserved for what somebody typed.
  md: 'h-(--control-h) min-w-(--control-h) gap-2 px-3.5 text-nav',
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
      data-part="button"
      className={cn(
        // A softly rounded rectangle, not a pill: it sits beside fields and
        // cards of the same 8-14px family instead of on top of them.
        'pill-text inline-flex items-center cursor-pointer justify-center rounded-control font-medium',
        // A control of a fixed height cannot wrap: a narrow table column turned "فتح الملف" into
        // two lines and the box clipped the second.
        'whitespace-nowrap',
        // The fill settles over a quarter of a second; the press does not wait for it, or a button
        // would go soft under the finger.
        '[transition:background-color_250ms_ease-in-out,border-color_250ms_ease-in-out,color_250ms_ease-in-out,scale_120ms_ease-out]',
        'active:scale-[0.98]',
        // Disabled is a solid muted fill with no edge, as a disabled field is. At 40% opacity a
        // white label on the primary fill was barely there at all.
        'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-inset',
        'disabled:text-ink-subtle disabled:shadow-none',
        // A disabled button must not still look like it responds.
        'disabled:active:scale-100 disabled:hover:bg-inset disabled:hover:text-ink-subtle',
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
  return <Icon name="spinner" data-part="button-spinner" className="animate-spin" />;
}
