import type { JSX, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { usePageActionSlot } from '@web/components/layout/page-action-slot';
import { Tag } from '@web/components/ui/tag';
import { useDocumentTitle } from '@web/lib/document-title';

export interface PageHeaderProps {
  title: string;
  subtitle?: string | undefined;
  /** Acts on what is already here — save, print. Stays with the page it belongs to. */
  actions?: ReactNode | undefined;
  /** Makes a new one. Rides in the top bar, where the reference puts it. */
  primaryAction?: ReactNode | undefined;
  /** The reference's count chip: what this page is a list of, in figures. */
  count?: ReactNode | undefined;
}

// Every screen with a heading gets its tab title from it here, rather than each calling the hook.
export function PageHeader({
  title,
  subtitle,
  actions,
  primaryAction,
  count,
}: PageHeaderProps): JSX.Element {
  const { t } = useTranslation();
  const slot = usePageActionSlot();

  useDocumentTitle(t(title));

  // Without a bar to ride in — a test, the booking app — it falls back to the page's own row rather
  // than going missing.
  const hosted = slot !== null && primaryAction !== undefined;
  const inRow = hosted ? undefined : primaryAction;

  return (
    <header className="mt-1.5 mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      {hosted && createPortal(primaryAction, slot)}

      <div className="min-w-0">
        {/* Blue rather than ink, as the reference sets every page's title. */}
        <h1 className="text-title font-medium text-primary-900">{t(title)}</h1>
        {subtitle !== undefined && <p className="mt-1 text-value text-ink-muted">{t(subtitle)}</p>}
      </div>

      {(actions !== undefined || inRow !== undefined || count !== undefined) && (
        <div className="flex shrink-0 flex-col gap-2.5 sm:ms-auto sm:flex-row sm:items-center">
          {(inRow !== undefined || actions !== undefined) && (
            // Full width on a phone, hugging its content from `sm` up: a lone
            // button floating at one edge of a narrow screen reads as debris.
            <div className="flex flex-col gap-2.5 [&>*]:w-full sm:flex-row sm:items-center sm:[&>*]:w-auto">
              {inRow}
              {actions}
            </div>
          )}

          {/* Last, so it lands at the far edge from the title — the corner the reference puts the
              count in. `self-start` because a count is not a control: stretched to the width of a
              phone it reads as a banner. */}
          {count !== undefined && <Tag className="shrink-0 self-start">{count}</Tag>}
        </div>
      )}
    </header>
  );
}
