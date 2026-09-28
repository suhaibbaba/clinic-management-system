import type { UserRole } from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";

function FullPageMessage({ messageKey }: { messageKey: string }): JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      data-testid="full-page-message"
      className="flex min-h-full items-center justify-center p-8 text-value text-ink-muted"
    >
      {t(messageKey)}
    </div>
  );
}

function BootSkeleton(): JSX.Element {
  const showSkeleton = useDelayedLoading(true);

  if (!showSkeleton) {
    return <></>;
  }

  return (
    <div data-testid="boot-skeleton" className="flex min-h-full flex-col rail:flex-row">
      <SkeletonStatus />
      <div
        aria-hidden="true"
        className="hidden shrink-0 flex-col gap-3 border-e border-line bg-rail px-[18px] pt-5 rail:flex rail:h-dvh rail:w-[266px]"
      >
        <Skeleton className="mb-3 h-[70px] w-full rounded-brand" />
        {Array.from({ length: 7 }, (_, item) => (
          <Skeleton key={item} className="h-(--control-h) w-full rounded-control" />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-4 rail:px-[34px] rail:pt-[26px]"
      >
        <Skeleton className="h-[70px] w-full rounded-card" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const { status } = useSession();
  const location = useLocation();

  if (status === "loading") {
    return <BootSkeleton />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function RequireRole({
  roles,
  redirectTo,
  children,
}: {
  roles: readonly UserRole[];
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
