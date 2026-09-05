import type { UserRole } from '@clinic/shared';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';

import { useSession } from '@web/features/auth/session';

function FullPageMessage({ messageKey }: { messageKey: string }): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-full items-center justify-center p-8 text-sm text-gray-500">
      {t(messageKey)}
    </div>
  );
}

/** Sends signed-out visitors to the login page, remembering where they were. */
export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageMessage messageKey="common.loading" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/**
 * Route-level role check mirroring the sidebar filter, so a hidden page cannot
 * be reached by typing its URL. Cosmetic in the same sense the sidebar is: the
 * API refuses the request regardless.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: readonly UserRole[];
  children: ReactNode;
}): JSX.Element {
  const { user, hasRole } = useSession();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRole(...roles)) {
    return <FullPageMessage messageKey="errors.forbidden" />;
  }

  return <>{children}</>;
}
