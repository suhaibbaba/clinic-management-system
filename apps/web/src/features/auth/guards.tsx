import type { UserRole } from '@clinic/shared';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';

import { useSession } from '@web/features/auth/session';

function FullPageMessage({ messageKey }: { messageKey: string }): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-full items-center justify-center p-8 text-value text-ink-muted">
      {t(messageKey)}
    </div>
  );
}

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

// Mirrors the sidebar filter, so a hidden page cannot be reached by typing its URL. The API refuses
// the request regardless.
export function RequireRole({
  roles,
  redirectTo,
  children,
}: {
  roles: readonly UserRole[];
  // A deep link into another role's records is redirected rather than explained: naming what they
  // cannot open confirms the record exists.
  redirectTo?: string | undefined;
  children: ReactNode;
}): JSX.Element {
  const { user, hasRole } = useSession();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRole(...roles)) {
    return redirectTo !== undefined ? (
      <Navigate to={redirectTo} replace />
    ) : (
      <FullPageMessage messageKey="errors.forbidden" />
    );
  }

  return <>{children}</>;
}
