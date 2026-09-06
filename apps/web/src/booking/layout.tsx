import type { JSX, ReactNode } from 'react';

import logoUrl from '@web/assets/logo.svg';
import { t } from '@web/booking/i18n';
import { cx } from '@web/booking/ui';

/**
 * The page frame: the clinic's mark and name, then whatever step is showing.
 *
 * One column, 480px at most, centred. On a phone that is the whole screen; on
 * a laptop it is a card-width sheet in the middle of the grey ground rather
 * than a form stretched across 1400px.
 */
export function PageShell({
  clinicName,
  children,
  footer,
}: {
  readonly clinicName: string | undefined;
  readonly children: ReactNode;
  /** Sticks to the bottom of the viewport on a phone — the thumb is there. */
  readonly footer?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-center gap-2.5 px-4 py-5">
        <img src={logoUrl} alt="" aria-hidden className="h-8 w-auto" />
        <span className="text-value font-semibold tracking-[-0.02em] text-ink">
          {clinicName ?? t('page.title')}
        </span>
      </header>

      <main className="mx-auto w-full max-w-[480px] flex-1 px-4 pb-6">{children}</main>

      {footer && (
        <div
          className={cx(
            'sticky bottom-0 z-10 border-t border-line bg-surface',
            // Clears the home indicator on an iPhone without a fixed guess.
            'px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          )}
        >
          <div className="mx-auto w-full max-w-[480px]">{footer}</div>
        </div>
      )}
    </div>
  );
}

const STEP_KEYS = ['steps.doctor', 'steps.when', 'steps.details', 'steps.confirm'] as const;

/**
 * Where the patient is, in words and in four bars.
 *
 * The bars alone would be decoration — `aria-hidden` — so the sentence above
 * them carries the same fact for a screen reader, and `aria-live` announces it
 * when the step changes rather than leaving someone who cannot see the bars to
 * infer it from a heading.
 */
export function StepHeader({
  current,
  title,
}: {
  /** 1-based, so it reads the way the copy does. */
  readonly current: number;
  readonly title: string;
}): JSX.Element {
  return (
    <div className="mb-4">
      <p aria-live="polite" className="text-label font-medium text-ink-muted">
        {t('steps.counter', { current, total: STEP_KEYS.length })}
      </p>

      <h1 className="mt-1 text-[1.375rem] leading-8 font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h1>

      <ol aria-hidden className="mt-3 flex gap-1.5">
        {STEP_KEYS.map((key, index) => (
          <li
            key={key}
            className={cx(
              'h-1 flex-1 rounded-pill transition-colors duration-200',
              index < current ? 'bg-primary-600' : 'bg-neutral-200',
            )}
          />
        ))}
      </ol>
    </div>
  );
}

/** The whole page said one thing and it was bad news. */
export function FullPageMessage({
  title,
  body,
  action,
}: {
  readonly title: string;
  readonly body?: string;
  readonly action?: ReactNode;
}): JSX.Element {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 text-center">
      <h1 className="text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
      {body && <p className="text-value text-ink-muted">{body}</p>}
      {action}
    </div>
  );
}
