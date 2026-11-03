import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge, EmptyState, PersonName, Widget } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { Money } from "@web/shared/components/money";
import { formatTime } from "@web/shared/lib/format";
import { useSession } from "@web/shared/providers/session";
import { canOpenPatientFile } from "@web/shared/permissions/patients";
import { useDashboardVisits } from "@web/modules/dashboard/queries";

export function VisitsToday({ currency }: { readonly currency: string | undefined }): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const visits = useDashboardVisits();
  const linked = canOpenPatientFile(can);

  return (
    <Widget
      data-testid="dashboard-visits"
      title={
        <>
          {t("dashboard.widgets.visitsToday.title")}
          {visits.data && <Badge plain>{visits.data.total}</Badge>}
        </>
      }
    >
      {visits.isPending && (
        <Skeleton aria-hidden="true" className="mt-3 h-40 w-full rounded-panel" />
      )}

      {visits.data?.items.length === 0 && (
        <div className="mt-2">
          <EmptyState
            icon="stethoscope"
            data-testid="dashboard-visits-empty"
            title="dashboard.visits.empty"
          />
        </div>
      )}

      {visits.data && visits.data.items.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {visits.data.items.map((visit) => {
            const row: ReactNode = (
              <>
                <span className="w-20 shrink-0 text-label text-ink-muted">
                  {formatTime(visit.visitDate)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{visit.patientName}</span>
                  <span className="truncate text-label text-ink-muted">
                    <PersonName name={visit.doctorName} />
                  </span>
                </span>
                {visit.balance !== undefined &&
                  (Number(visit.balance) > 0 ? (
                    <Badge tone="warning">
                      <Money amount={visit.balance} currency={currency} />
                    </Badge>
                  ) : (
                    <Badge tone="success">{t("dashboard.visits.settled")}</Badge>
                  ))}
              </>
            );

            return (
              <li key={visit.id} data-testid={`dashboard-visit-${visit.id}`}>
                {linked ? (
                  <Link
                    to={`/patients/${visit.patientId}`}
                    className="flex min-h-(--control-h) items-center gap-3 py-2 hover:bg-inset"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex min-h-(--control-h) items-center gap-3 py-2">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}
