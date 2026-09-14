import { ToastProvider } from '@clinic/ui';
import { UiProvider } from '@clinic/ui/theme';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { createQueryClient } from '@web/app/query-client';
import { SessionProvider } from '@web/features/auth/session';
import { isRtl } from '@web/i18n';
import { DocumentTitleProvider } from '@web/lib/document-title';
import { abuObaidTheme } from '@web/theme';

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  const { i18n } = useTranslation();
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    // `UiProvider` keeps the document direction in step with the active language. The initial value
    // is already `dir="rtl"` in index.html, so the first paint is correct.
    <UiProvider
      theme={abuObaidTheme}
      direction={isRtl(i18n.language) ? 'rtl' : 'ltr'}
      lang={i18n.language}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SessionProvider>
            <DocumentTitleProvider>{children}</DocumentTitleProvider>
          </SessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </UiProvider>
  );
}
