import { DASHBOARD_LIST_LIMIT } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { EmptyState, Widget } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { canOpenPatientFile } from "@web/shared/permissions/patients";
import { usePatients } from "@web/shared/queries/patients";

export function NewPatients(): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const patients = usePatients({ limit: DASHBOARD_LIST_LIMIT });
  const linked = canOpenPatientFile(can);

  return (
    <Widget data-testid="dashboard-new-patients" title={t("dashboard.widgets.newPatients.title")}>
      {patients.isPending && (
        <Skeleton aria-hidden="true" className="mt-3 h-32 w-full rounded-panel" />
      )}

      {patients.data?.items.length === 0 && (
        <EmptyState
          icon="users"
          data-testid="dashboard-new-patients-empty"
          title="dashboard.newPatients.empty"
        />
      )}

      {patients.data && patients.data.items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5">
          {patients.data.items.map((patient) => {
            const content = (
              <>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{patient.fullName}</span>
                  <span className="truncate text-label text-ink-muted">
                    {t("dashboard.newPatients.file", { number: patient.fileNumber })}
                  </span>
                </span>
              </>
            );

            return (
              <li key={patient.id} data-testid={`dashboard-new-patient-${patient.id}`}>
                {linked ? (
                  <Link
                    to={`/patients/${patient.id}`}
                    className="-mx-2 flex min-h-(--control-h) items-center gap-3 rounded-panel px-2 py-1.5 transition-colors duration-150 hover:bg-inset"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex min-h-(--control-h) items-center gap-3 py-1.5">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}
