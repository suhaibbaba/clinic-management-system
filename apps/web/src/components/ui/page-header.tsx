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
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t(title)}</h1>
        {subtitle !== undefined && <p className="mt-1 text-value text-ink-muted">{t(subtitle)}</p>}
      </div>

      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
