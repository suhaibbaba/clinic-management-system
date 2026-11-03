import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { EmptyState, Icon, Widget } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { Money } from "@web/shared/components/money";
import { formatDate } from "@web/shared/lib/format";
import { useSession } from "@web/shared/providers/session";
import { canOpenPatientFile } from "@web/shared/permissions/patients";
import { useDashboardTopDebts } from "@web/modules/dashboard/queries";

export function TopDebts({ currency }: { readonly currency: string | undefined }): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const debts = useDashboardTopDebts();
  const linked = canOpenPatientFile(can);

  return (
    <Widget
      data-testid="dashboard-debts"
      title={t("dashboard.widgets.topDebts.title")}
      action={
        <Link
          to="/patients?filter=balance"
          data-testid="dashboard-debts-all"
          className="inline-flex items-center gap-1 text-label font-medium text-primary-600 hover:text-primary-700"
        >
          {t("dashboard.debts.all")}
          <Icon name="chevron-end" className="size-4" />
        </Link>
      }
    >
      {debts.isPending && (
        <Skeleton aria-hidden="true" className="mt-3 h-32 w-full rounded-panel" />
      )}

      {debts.data?.items.length === 0 && (
        <EmptyState
          icon="money"
          data-testid="dashboard-debts-empty"
          title="dashboard.debts.empty"
        />
      )}

      {debts.data && debts.data.items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5">
          {debts.data.items.map((debt) => {
            const content = (
              <>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{debt.fullName}</span>
                  <span className="truncate text-label text-ink-muted">
                    {debt.lastPaymentAt === null
                      ? t("dashboard.debts.neverPaid")
                      : t("dashboard.debts.lastPaid", { when: formatDate(debt.lastPaymentAt) })}
                  </span>
                </span>
                <Money
                  amount={debt.balance}
                  currency={currency}
                  className="shrink-0 font-semibold text-danger-600"
                />
              </>
            );

            return (
              <li key={debt.patientId} data-testid={`dashboard-debt-${debt.patientId}`}>
                {linked ? (
                  <Link
                    to={`/patients/${debt.patientId}`}
                    className="-mx-2 flex min-h-(--control-h) items-center gap-3 rounded-panel px-2 py-2 transition-colors duration-150 hover:bg-inset"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex min-h-(--control-h) items-center gap-3 py-2">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}
