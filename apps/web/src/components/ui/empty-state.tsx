import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon, type IconName } from '@web/components/ui/icon';

export interface EmptyStateProps {
  /** i18n keys. */
  title: string;
  hint?: string | undefined;
  action?: ReactNode | undefined;
  /**
   * The thing that is missing, drawn. Defaults to a neutral document, so an
   * empty state is never a bare paragraph in a dashed box — the icon is what
   * makes it read as "nothing here yet" rather than as a failed render.
   */
  icon?: IconName | undefined;
}

export function EmptyState({ title, hint, action, icon = 'file' }: EmptyStateProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-pill bg-inset text-primary-600">
        <Icon name={icon} size="md" />
      </span>

      <p className="text-value font-semibold text-ink">{t(title)}</p>
      {hint !== undefined && <p className="mt-1 text-label text-ink-muted">{t(hint)}</p>}
      {action !== undefined && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
