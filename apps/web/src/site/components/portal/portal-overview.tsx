import type { PortalRecord } from "@clinic/shared";
import type { JSX } from "react";
import { PortalAppointments } from "@web/site/components/portal/portal-appointments";
import { PortalBalance } from "@web/site/components/portal/portal-billing";
import { PortalTreatments } from "@web/site/components/portal/portal-treatments";
import { SiteIcon } from "@web/site/components/site-icon";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { splitAppointments } from "@web/site/lib/portal";

const RECENT = 3;

export function PortalOverview({
  record,
  format,
}: {
  readonly record: PortalRecord;
  readonly format: PortalFormat;
}): JSX.Element {
  const { t } = useSite();
  const { upcoming } = splitAppointments(record.appointments, new Date());
  const alerts = [...record.patient.allergies, ...record.patient.chronicConditions];

  return (
    <div className="flex flex-col gap-4">
      <PortalBalance balance={record.balance} format={format} />
      {alerts.length > 0 && (
        <p
          data-testid="site-portal-alerts"
          className="flex items-start gap-2 rounded-card border border-danger-100 bg-danger-50 px-4 py-3 text-value text-danger-800"
        >
          <SiteIcon name="shield" className="mt-0.5 size-5" />
          <span>
            <span className="font-bold">{t("portal.medicalAlerts")}: </span>
            {alerts.join(" · ")}
          </span>
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <PortalAppointments
          title={t("portal.upcoming")}
          empty={t("portal.empty.upcoming")}
          appointments={upcoming.slice(0, RECENT)}
          format={format}
          data-testid="site-portal-next"
        />
        <PortalTreatments
          title={t("portal.recentTreatments")}
          empty={t("portal.empty.treatments")}
          treatments={record.treatments.slice(0, RECENT)}
          format={format}
          data-testid="site-portal-recent-treatments"
        />
      </div>
    </div>
  );
}
