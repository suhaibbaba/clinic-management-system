import type { ButtonHTMLAttributes, InputHTMLAttributes, JSX, ReactNode } from 'react';

/**
 * The booking page's own handful of controls.
 *
 * Not `@web/components/ui`: that library is Radix-backed — dialogs, popovers,
 * toasts, a day picker — and importing one button from it pulls a good part of
 * the dashboard's dependency graph into a bundle that has to stay under 80 KB.
 * What this page actually needs is a button, a card, an input and a skeleton,
 * and they are cheaper to write than to prune.
 *
 * They are built from the same tokens as the app, so the two look like one
 * product even though they share no component code.
 */

/** Joins class names. No `tailwind-merge` here — 6 KB to resolve conflicts
 *  this file simply does not create. */
export const cx = (...parts: (string | false | undefined | null)[]): string =>
  parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-ink-inverse hover:bg-primary-700 active:bg-primary-800',
  secondary: 'bg-inset text-ink hover:bg-neutral-200 active:bg-neutral-300',
  ghost: 'text-primary-700 hover:bg-primary-50',
  danger: 'bg-danger-600 text-ink-inverse hover:bg-danger-700 active:bg-danger-800',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly busy?: boolean;
  readonly full?: boolean;
}

export function Button({
  variant = 'primary',
  busy = false,
  full = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      // 48px tall: this is a thumb on a phone, not a mouse on a desktop.
      className={cx(
        'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-control',
        'px-5 text-field font-semibold transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        BUTTON_VARIANTS[variant],
        full && 'w-full',
        className,
      )}
      disabled={disabled === true || busy}
      {...(busy && { 'aria-busy': true })}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

function Spinner(): JSX.Element {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}): JSX.Element {
  return (
    <section className={cx('rounded-card bg-surface p-4 shadow-card', className)}>
      {children}
    </section>
  );
}

/**
 * A selectable card — a doctor, and nothing else so far.
 *
 * A real `<button>` rather than a div with a click handler, so it is tabbable,
 * activates on Enter and Space, and announces itself as pressed.
 */
export function ChoiceCard({
  selected,
  onClick,
  label,
  children,
}: {
  readonly selected: boolean;
  readonly onClick: () => void;
  /** What a screen reader announces; the visible content can be richer. */
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cx(
        'flex w-full cursor-pointer items-center gap-3 rounded-card p-4 text-start',
        'transition-colors duration-150',
        selected
          ? 'bg-selected ring-2 ring-primary-600'
          : 'bg-surface shadow-card hover:bg-row-hover',
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                    */
/* -------------------------------------------------------------------------- */

export function Alert({
  tone = 'danger',
  children,
}: {
  readonly tone?: 'danger' | 'info';
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <p
      // Announced when it appears: an error a screen reader never reads is an
      // error the page did not report.
      role="status"
      className={cx(
        'rounded-panel px-3 py-2.5 text-value',
        tone === 'danger' ? 'bg-danger-50 text-danger-800' : 'bg-primary-50 text-primary-900',
      )}
    >
      {children}
    </p>
  );
}

/** A grey block standing in for content that has not arrived. */
export function Skeleton({ className }: { readonly className?: string }): JSX.Element {
  return <span aria-hidden className={cx('booking-skeleton block rounded-panel', className)} />;
}

/* -------------------------------------------------------------------------- */
/* Fields                                                                      */
/* -------------------------------------------------------------------------- */

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}

/**
 * A labelled input.
 *
 * `text-field` is 16px, which is not a style choice: iOS Safari zooms the page
 * when a smaller field takes focus and never zooms back out. This page exists
 * to be filled in on a phone.
 */
export function Field({ label, error, hint, id, className, ...rest }: FieldProps): JSX.Element {
  const fieldId = id ?? `field-${rest.name ?? label}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = cx(error && errorId, hint && hintId) || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-value font-medium text-ink">
        {label}
      </label>

      <input
        id={fieldId}
        className={cx(
          'min-h-12 w-full rounded-control border bg-surface px-3 text-field text-ink',
          'placeholder:text-ink-subtle',
          error ? 'border-danger-500' : 'border-line-strong focus:border-primary-600',
          className,
        )}
        {...(describedBy && { 'aria-describedby': describedBy })}
        {...(error && { 'aria-invalid': true })}
        {...rest}
      />

      {hint && !error && (
        <span id={hintId} className="text-label text-ink-muted">
          {hint}
        </span>
      )}

      {error && (
        <span id={errorId} role="alert" className="text-label font-medium text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}
