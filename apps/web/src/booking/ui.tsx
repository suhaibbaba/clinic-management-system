import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type JSX,
  type ReactNode,
} from 'react';

// Not `@web/components/ui`: that library is Radix-backed, and one button from it pulls much of the
// dashboard's dependency graph into an 80 KB budget.

/** Joins class names. No `tailwind-merge` here — 6 KB to resolve conflicts
 *  this file simply does not create. */
export const cx = (...parts: (string | false | undefined | null)[]): string =>
  parts.filter(Boolean).join(' ');

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

// A real `<button>`, so it is tabbable, activates on Enter and Space, and announces itself as
// pressed.
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

export function Skeleton({ className }: { readonly className?: string }): JSX.Element {
  return <span aria-hidden className={cx('skeleton block rounded-panel', className)} />;
}

// The dashboard's `Img` in miniature — the wall keeps `@web/components` out of this bundle. Same
// contract: a box reserved up front that every state fills, so no image moves the form under it.
export function Img({
  src,
  alt,
  width,
  height,
  priority = false,
  fallback,
}: {
  readonly src: string | null | undefined;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly priority?: boolean;
  readonly fallback?: ReactNode;
}): JSX.Element {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => setState('loading'), [src]);

  const missing = src === null || src === undefined || src === '';

  return (
    <span style={{ width, height }} className="relative block max-w-full shrink-0 overflow-hidden">
      {!missing && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          {...(priority ? { loading: 'eager', fetchPriority: 'high' } : { loading: 'lazy' })}
          decoding="async"
          className={cx(
            'size-full object-contain transition-opacity duration-[120ms]',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {!missing && state === 'loading' && (
        <Skeleton className="absolute inset-0 size-full rounded-none" />
      )}

      {(missing || state === 'failed') && fallback}
    </span>
  );
}

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}

// 16px is not a style choice: iOS Safari zooms the page when a smaller field takes focus and never
// zooms back.
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
          // `dir="ltr"` keeps the digits in order, but the alignment belongs to the page — by its
          // own direction the field sat left of an Arabic form, under a label on the right.
          rest.dir === 'ltr' ? 'page-rtl:text-right page-ltr:text-left' : 'text-start',
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
