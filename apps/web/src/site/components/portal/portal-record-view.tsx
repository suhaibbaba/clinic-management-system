import type { PortalAccount } from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Alert, Button, Skeleton } from "@web/booking/ui";
import { useAsync } from "@web/booking/use-async";
import { isSignedOut, portalApi, siteFailureKey } from "@web/site/api";
import { PortalAppointments } from "@web/site/components/portal/portal-appointments";
import { PortalBalance, PortalStatement } from "@web/site/components/portal/portal-billing";
import { PortalFiles } from "@web/site/components/portal/portal-files";
import { PortalOverview } from "@web/site/components/portal/portal-overview";
import { PortalPrescriptions } from "@web/site/components/portal/portal-prescriptions";
import { PortalTabs } from "@web/site/components/portal/portal-tabs";
import { PortalTreatments } from "@web/site/components/portal/portal-treatments";
import { PortalVisits } from "@web/site/components/portal/portal-visits";
import { SITE_PARAM } from "@web/site/constants";
import { usePortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { chosenPatient, portalTab, splitAppointments } from "@web/site/lib/portal";

export function PortalRecordView({
  account,
  onExpired,
  onSignOut,
}: {
  readonly account: PortalAccount;
  readonly onExpired: () => void;
  readonly onSignOut: () => void;
}): JSX.Element {
  const { t, params, setParams } = useSite();
  const tab = portalTab(params.get(SITE_PARAM.TAB));
  const patientId = chosenPatient(account, params.get(SITE_PARAM.PATIENT));
  const format = usePortalFormat(account);
  const loaded = useAsync(
    () => portalApi.record(patientId ?? ""),
    [patientId],
    patientId !== undefined,
  );
  const record = loaded.data;

  useEffect(() => {
    if (isSignedOut(loaded.error)) {
      onExpired();
    }
  }, [loaded.error, onExpired]);

  const { upcoming, past } = splitAppointments(record?.appointments ?? [], new Date());

  return (
    <div data-testid="site-portal-account" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-title font-bold text-primary-900">
            {record?.patient.fullName ?? t("portal.title")}
          </h2>
          {record && (
            <span className="text-label text-ink-muted">
              {t("portal.fileNumber", { number: record.patient.fileNumber })}
            </span>
          )}
        </div>
        <Button variant="secondary" data-testid="site-portal-sign-out" onClick={onSignOut}>
          {t("portal.signOut")}
        </Button>
      </div>

      {account.patients.length > 1 && (
        <div
          role="group"
          aria-label={t("portal.family")}
          data-testid="site-portal-family"
          className="flex flex-wrap gap-2"
        >
          {account.patients.map((patient) => (
            <button
              key={patient.id}
              type="button"
              aria-pressed={patient.id === patientId}
              data-testid={`site-portal-patient-${patient.id}`}
              onClick={() => setParams({ [SITE_PARAM.PATIENT]: patient.id })}
              className="pill-text inline-flex min-h-(--control-h) cursor-pointer items-center rounded-pill border border-line bg-surface px-4 text-label font-medium text-ink-muted hover:border-primary-300 aria-pressed:border-primary-600 aria-pressed:bg-primary-50 aria-pressed:text-primary-900"
            >
              {patient.firstName}
            </button>
          ))}
        </div>
      )}

      {account.patients.length === 0 ? (
        <Alert tone="info">{t("portal.noPatients")}</Alert>
      ) : (
        <>
          <PortalTabs
            active={tab}
            onSelect={(next) => setParams({ [SITE_PARAM.TAB]: next === "overview" ? null : next })}
          />
          <div id="portal-panel" role="tabpanel" aria-labelledby={`portal-tab-${tab}`}>
            {loaded.loading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-24 rounded-card" />
                <Skeleton className="h-48 rounded-card" />
              </div>
            ) : !record ? (
              <div className="flex flex-col items-start gap-3">
                <Alert>{t(siteFailureKey(loaded.error))}</Alert>
                <Button variant="secondary" onClick={loaded.reload}>
                  {t("common.retry")}
                </Button>
              </div>
            ) : tab === "appointments" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <PortalAppointments
                  title={t("portal.upcoming")}
                  empty={t("portal.empty.upcoming")}
                  appointments={upcoming}
                  format={format}
                  data-testid="site-portal-upcoming"
                />
                <PortalAppointments
                  title={t("portal.history")}
                  empty={t("portal.empty.history")}
                  appointments={past}
                  format={format}
                  data-testid="site-portal-history"
                />
              </div>
            ) : tab === "treatments" ? (
              <div className="flex flex-col gap-4">
                <PortalTreatments
                  title={t("portal.tabs.treatments")}
                  empty={t("portal.empty.treatments")}
                  treatments={record.treatments}
                  format={format}
                  data-testid="site-portal-treatments"
                />
                <PortalVisits visits={record.visits} format={format} />
              </div>
            ) : tab === "billing" ? (
              <div className="flex flex-col gap-4">
                <PortalBalance balance={record.balance} format={format} />
                <PortalStatement statement={record.statement} format={format} />
              </div>
            ) : tab === "prescriptions" ? (
              <PortalPrescriptions prescriptions={record.prescriptions} format={format} />
            ) : tab === "files" ? (
              <PortalFiles
                patientId={record.patient.id}
                files={record.attachments}
                format={format}
              />
            ) : (
              <PortalOverview record={record} format={format} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
