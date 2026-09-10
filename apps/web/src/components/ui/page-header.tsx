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
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {/*
          20px, at every width. The title used to be 34 and had to step down on
          a phone, where it ate a third of the screen before any content; at
          this size it is the same object in both shapes, and the actions
          beside it are what the eye goes to next rather than fighting it.
        */}
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
