import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface PageHeaderProps {
  /** i18n keys. */
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-title font-bold tracking-[-0.03em] text-ink">{t(title)}</h1>
        {subtitle !== undefined && (
          <p className="mt-1.5 text-value text-ink-muted">{t(subtitle)}</p>
        )}
      </div>

      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
