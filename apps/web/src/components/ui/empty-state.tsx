import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon, type IconName } from '@web/components/ui/icon';

export interface EmptyStateProps {
  title: string;
  hint?: string | undefined;
  action?: ReactNode | undefined;
  icon?: IconName | undefined;
}

export function EmptyState({ title, hint, action, icon = 'file' }: EmptyStateProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-field bg-primary-100 text-primary-700">
        <Icon name={icon} size="md" />
      </span>

      <p className="text-section font-medium text-ink">{t(title)}</p>
      {hint !== undefined && <p className="mt-1 text-label text-ink-muted">{t(hint)}</p>}
      {action !== undefined && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
