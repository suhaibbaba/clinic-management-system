import { DASHBOARD_CUSTOMIZE_PARAM } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge, Card, EmptyState, Icon } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { formatDateTime } from "@web/shared/lib/format";
import { useSession } from "@web/shared/providers/session";
import { canCustomizeDashboard } from "@web/shared/permissions/dashboard";
import { useDashboardLayouts } from "@web/modules/dashboard/queries";

export function DashboardLayoutsPage(): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const layouts = useDashboardLayouts(true);
  const editable = canCustomizeDashboard(can);

  if (layouts.isPending) {
    return <Skeleton aria-hidden="true" className="h-[320px] w-full rounded-card" />;
  }

  if (layouts.isError) {
    return (
      <EmptyState
        icon="alert"
        data-testid="dashboard-layouts-error"
        title="errors.unknown"
        hint="dashboard.failed"
      />
    );
  }

  return (
    <Card data-testid="dashboard-layouts" className="flex max-w-(--form-max) flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-value font-semibold">{t("dashboard.layouts.title")}</h2>
        <p className="text-label text-ink-muted">{t("dashboard.layouts.hint")}</p>
      </div>

      <ul className="flex flex-col divide-y divide-line">
        {layouts.data.roles.map((entry) => (
          <li
            key={entry.role}
            data-testid={`dashboard-layouts-${entry.role}`}
            className="flex flex-wrap items-center gap-3 py-3"
          >
            <span className="min-w-0 flex-1 font-medium">{t(`roles.${entry.role}`)}</span>

            <span className="text-label text-ink-muted">
              {t("dashboard.layouts.shown", {
                number: entry.layout.widgets.filter((widget) => widget.visible).length,
              })}
            </span>

            {entry.customized && entry.updatedAt !== null ? (
              <Badge tone="wash" plain>
                {t("dashboard.layouts.customizedAt", { when: formatDateTime(entry.updatedAt) })}
              </Badge>
            ) : (
              <Badge plain>{t("dashboard.layouts.standard")}</Badge>
            )}

            {editable && (
              <Link
                to={`/dashboard?${DASHBOARD_CUSTOMIZE_PARAM}=${entry.role}`}
                target="_blank"
                rel="noopener"
                data-testid={`dashboard-layouts-${entry.role}-customize`}
                className="inline-flex min-h-(--control-h) items-center gap-1.5 rounded-field border border-line px-3 text-label font-medium text-primary-700 hover:border-primary-600 lg:min-h-(--control-h-sm)"
              >
                {t("dashboard.layouts.customize")}
                <Icon name="chevron-end" className="size-4" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
