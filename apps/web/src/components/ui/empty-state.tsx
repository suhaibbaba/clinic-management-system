import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface EmptyStateProps {
  /** i18n keys. */
  title: string;
  hint?: string | undefined;
  action?: ReactNode | undefined;
}

export function EmptyState({ title, hint, action }: EmptyStateProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{t(title)}</p>
      {hint !== undefined && <p className="mt-1 text-sm text-ink-muted">{t(hint)}</p>}
      {action !== undefined && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
