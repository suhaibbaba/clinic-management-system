import type { PortalRecord } from "@clinic/shared";
import type { JSX } from "react";
import { PortalBalanceSummary } from "@web/site/components/portal/portal-billing";
import { PortalNextVisit } from "@web/site/components/portal/portal-next-visit";
import { PortalTreatments } from "@web/site/components/portal/portal-treatments";
import { SiteIcon } from "@web/site/components/site-icon";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { splitAppointments } from "@web/site/lib/portal";

const RECENT = 3;

export function PortalOverview({
  record,
  format,
  onShowTreatments,
}: {
  readonly record: PortalRecord;
  readonly format: PortalFormat;
  readonly onShowTreatments: () => void;
}): JSX.Element {
  const { t } = useSite();
  const { upcoming } = splitAppointments(record.appointments, new Date());
  const alerts = [...record.patient.allergies, ...record.patient.chronicConditions];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-5">
        <PortalNextVisit appointment={upcoming[0]} format={format} />
        <PortalBalanceSummary balance={record.balance} format={format} />
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
        {alerts.length > 0 && (
          <section
            data-testid="site-portal-alerts"
            aria-labelledby="portal-alerts-title"
            className="flex items-start gap-3.5 rounded-card border border-warning-100 bg-warning-50 px-5 py-4"
          >
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-pill bg-warning-100 text-warning-800"
            >
              <SiteIcon name="alert" className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <h3 id="portal-alerts-title" className="text-section font-bold text-warning-800">
                {t("portal.medicalAlerts")}
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {alerts.map((alert) => (
                  <li
                    key={alert}
                    className="pill-text inline-flex min-h-(--control-h-sm) items-center rounded-chip border border-warning-100 bg-surface px-2.5 text-label text-warning-800"
                  >
                    <bdi>{alert}</bdi>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <PortalTreatments
          title={t("portal.recentTreatments")}
          empty={t("portal.empty.treatments")}
          treatments={record.treatments.slice(0, RECENT)}
          format={format}
          icon="history"
          action={
            record.treatments.length > 0 && (
              <button
                type="button"
                data-testid="site-portal-all-treatments"
                onClick={onShowTreatments}
                className="cursor-pointer text-label font-medium text-primary-700 hover:text-primary-900"
              >
                {t("portal.viewAll")}
              </button>
            )
          }
          data-testid="site-portal-recent-treatments"
        />
      </div>
    </div>
  );
}
