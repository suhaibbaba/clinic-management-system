import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { createQueryClient } from '@web/app/query-client';
import { ToastProvider } from '@web/components/ui';
import { SessionProvider } from '@web/features/auth/session';
import { isRtl } from '@web/i18n';

/** Everything the app needs above the router. */
export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  const { i18n } = useTranslation();
  const queryClient = useMemo(() => createQueryClient(), []);

  // Keeps the document direction in step with the active language. The initial
  // value is already `dir="rtl"` in index.html, so the first paint is correct.
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = isRtl(i18n.language) ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>{children}</SessionProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
