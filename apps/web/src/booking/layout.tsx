import { useEffect, type JSX, type ReactNode } from 'react';

import { t } from '@web/booking/i18n';
import { cx, Img } from '@web/booking/ui';

export function PageShell({
  clinicName,
  logoUrl,
  children,
  footer,
}: {
  readonly clinicName: string | undefined;
  readonly logoUrl?: string | null;
  readonly children: ReactNode;
  /** Sticks to the bottom of the viewport on a phone — the thumb is there. */
  readonly footer?: ReactNode;
}): JSX.Element {
  const name = clinicName ?? t('page.title');

  // Here rather than in each screen: every booking view is inside this shell.
  useEffect(() => {
    document.title =
      clinicName === undefined ? t('page.title') : `${t('page.title')} — ${clinicName}`;
  }, [clinicName]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-center gap-2.5 px-4 py-5">
        {/* Only the clinic's own: with none there is the name alone, never a mark belonging to
            somebody else. */}
        {logoUrl !== null && logoUrl !== undefined && (
          <Img src={logoUrl} alt="" width={32} height={32} priority />
        )}
        <span className="text-value font-medium tracking-[-0.02em] text-ink">{name}</span>
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

// The bars are `aria-hidden` decoration, so the sentence above them carries the fact and `aria-
// live` announces the change.
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

      <h1 className="mt-1 text-title font-medium tracking-title text-ink">{title}</h1>

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
      <h1 className="text-title font-medium tracking-title text-ink">{title}</h1>
      {body && <p className="text-value text-ink-muted">{body}</p>}
      {action}
    </div>
  );
}
