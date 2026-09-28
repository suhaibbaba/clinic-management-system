import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Icon } from "@clinic/ui";
import { backTarget } from "@web/shared/lib/navigation";
import { useSession } from "@web/shared/providers/session";

export function BackButton(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useSession();
  const target = backTarget(pathname, user?.role);

  if (target === undefined) {
    return null;
  }

  const label = t("nav.back", { to: t(target.label) });
  const cameFromApp = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

  return (
    <Button
      variant="secondary"
      size="sm"
      data-testid="app-back"
      className="rail:-ms-1"
      icon={<Icon name="chevron-start" />}
      aria-label={label}
      title={label}
      onClick={() => {
        if (cameFromApp) {
          void navigate(-1);
        } else {
          void navigate(target.to);
        }
      }}
    />
  );
}
