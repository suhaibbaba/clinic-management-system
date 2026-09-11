import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Tag } from '@web/components/ui/tag';
import { useDocumentTitle } from '@web/lib/document-title';

export interface PageHeaderProps {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  /** The reference's count chip: what this page is a list of, in figures. */
  count?: ReactNode | undefined;
}

// Every screen with a heading gets its tab title from it here, rather than each calling the hook.
export function PageHeader({ title, subtitle, actions, count }: PageHeaderProps): JSX.Element {
  const { t } = useTranslation();

  useDocumentTitle(t(title));

  return (
    <header className="mt-1.5 mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {/* Blue rather than ink, as the reference sets every page's title. */}
        <h1 className="text-title font-medium text-primary-900">{t(title)}</h1>
        {subtitle !== undefined && <p className="mt-1 text-value text-ink-muted">{t(subtitle)}</p>}
      </div>

      {(actions !== undefined || count !== undefined) && (
        // Full width on a phone, hugging its content from `sm` up: a lone
        // button floating at one edge of a narrow screen reads as debris.
        <div className="flex shrink-0 flex-col gap-2.5 [&>*]:w-full sm:ms-auto sm:flex-row sm:items-center sm:[&>*]:w-auto">
          {actions}
          {/* Last, so it lands at the far edge from the title — the corner the reference puts the
              count in, past whatever the page offers you to do. */}
          {count !== undefined && <Tag className="shrink-0">{count}</Tag>}
        </div>
      )}
    </header>
  );
}
