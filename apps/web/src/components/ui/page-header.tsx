import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useDocumentTitle } from '@web/lib/document-title';

export interface PageHeaderProps {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
}

// Every screen with a heading gets its tab title from it here, rather than each calling the hook.
export function PageHeader({ title, subtitle, actions }: PageHeaderProps): JSX.Element {
  const { t } = useTranslation();

  useDocumentTitle(t(title));

  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-title font-semibold tracking-title text-ink">{t(title)}</h1>
        {subtitle !== undefined && <p className="mt-1 text-value text-ink-muted">{t(subtitle)}</p>}
      </div>

      {actions !== undefined && (
        // Full width on a phone, hugging its content from `sm` up: a lone
        // button floating at one edge of a narrow screen reads as debris.
        <div className="flex shrink-0 flex-col gap-2 [&>*]:w-full sm:flex-row sm:items-center sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
