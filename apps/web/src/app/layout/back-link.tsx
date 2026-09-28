import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { backTarget } from "@web/shared/lib/navigation";
import { useSession } from "@web/shared/providers/session";

export function BackLink(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useSession();
  const target = backTarget(pathname, user?.role);

  if (target === undefined) {
    return null;
  }

  const cameFromApp = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

  return (
    <a
      href={target.to}
      data-testid="app-back"
      aria-label={t("nav.back", { to: t(target.label) })}
      onClick={(event) => {
        event.preventDefault();
        void (cameFromApp ? navigate(-1) : navigate(target.to));
      }}
      className={cn(
        "-ms-1 mb-2 inline-flex min-h-(--control-h-sm) items-center gap-1 rounded-control px-1",
        "text-label font-medium text-ink-muted transition-colors duration-150",
        "hover:text-primary-700",
      )}
    >
      <Icon name="chevron-start" className="size-4" />
      {t(target.label)}
    </a>
  );
}
