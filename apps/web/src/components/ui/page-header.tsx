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
    <header className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {/*
          34px is a desktop title. At 390px it eats a third of the screen
          before any content, so it steps down to 26px and back up at `sm`.
        */}
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-title">
          {t(title)}
        </h1>
        {subtitle !== undefined && (
          <p className="mt-1.5 text-value text-ink-muted">{t(subtitle)}</p>
        )}
      </div>

      {actions !== undefined && (
        // Full width on a phone, hugging its content from `sm` up: a lone
        // pill floating at one edge of a narrow screen reads as debris.
        <div className="flex shrink-0 flex-col gap-2 [&>*]:w-full sm:flex-row sm:items-center sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
