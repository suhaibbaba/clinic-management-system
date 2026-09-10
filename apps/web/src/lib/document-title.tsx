import { createContext, useContext, useEffect, useState, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { routeTitle } from '@web/app/navigation';
import { usePersonName } from '@web/components/ui/person-name';
import { useSession } from '@web/features/auth/session';
import { useClinicBranding } from '@web/features/clinic/queries';

const TitleContext = createContext<((title: string | null) => void) | null>(null);

/** `{page} — {clinic}`, and whichever half exists on its own. */
export function documentTitle(page: string | undefined, clinic: string | undefined): string {
  return [page, clinic].filter((part) => part !== undefined && part.trim() !== '').join(' — ');
}

/**
 * One effect writes `document.title`; screens register their part through `PageHeader` rather than
 * each setting it, so two of them can never race for the tab.
 */
export function DocumentTitleProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { status, user } = useSession();
  const resolve = usePersonName();
  const [page, setPage] = useState<string | null>(null);

  // Signed out there is no session to name the clinic, and the sign-in screen asks for the same
  // branding under the same key — so this is that response, not a second request.
  const branding = useClinicBranding(status === 'unauthenticated');
  const clinicName = resolve(user ? user.clinic.name : branding.data?.name);
  const route = routeTitle(pathname);

  useEffect(() => {
    document.title = documentTitle(
      page ?? (route === undefined ? undefined : t(route)),
      clinicName,
    );
  }, [page, route, clinicName, t]);

  return <TitleContext.Provider value={setPage}>{children}</TitleContext.Provider>;
}

/** Called by `PageHeader`, never by a screen: a screen's title is the heading it already renders. */
export function useDocumentTitle(title: string): void {
  const register = useContext(TitleContext);

  useEffect(() => {
    register?.(title);

    return () => register?.(null);
  }, [register, title]);
}
