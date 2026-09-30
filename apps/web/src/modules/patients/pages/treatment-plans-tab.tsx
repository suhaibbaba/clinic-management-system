import { PERFORMED_PROCEDURE_STATUS, type PatientClinicalView } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  EmptyState,
  Icon,
  Money,
  SegmentedControl,
  StatCard,
  useTabParam,
} from "@clinic/ui";
import { SkeletonCard, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { useClinic } from "@web/shared/queries/clinic";
import { canSeePrices } from "@web/shared/permissions/patients";
import { usePatientProcedures, useProcedureCatalog } from "@web/modules/patients/queries";
import { PlanPrint } from "@web/modules/patients/components/treatment-plans/plan-print";
import { TreatmentsPanel } from "@web/modules/patients/components/treatments/treatments-panel";
import { summarizeTreatments } from "@web/modules/patients/lib/treatments/treatments";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";
import { TREATMENT_FILTERS } from "@web/modules/patients/constants";

type TreatmentFilter = (typeof TREATMENT_FILTERS)[number];

export function TreatmentPlansTab({
  patientId,
  patient,
}: {
  patientId: string;
  patient: PatientClinicalView | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const clinic = useClinic();
  const catalog = useProcedureCatalog();
  const treatments = usePatientProcedures(patientId);
  const showSkeleton = useDelayedLoading(treatments.isPending);
  const [filter, setFilter] = useTabParam<TreatmentFilter>("status", TREATMENT_FILTERS, "all");
  const [printing, setPrinting] = useState(false);

  if (showSkeleton) {
    return (
      <div data-testid="treatment-plan-loading" className="flex flex-col gap-3">
        <SkeletonStatus />
        <SkeletonCard count={2} />
      </div>
    );
  }

  if (treatments.isPending) {
    return <></>;
  }

  if (treatments.isError) {
    return (
      <EmptyState
        icon="alert"
        data-testid="treatment-plan-error"
        title="errors.generic"
        hint="treatmentPlans.loadFailed"
      />
    );
  }

  const all = treatments.data;
  const summary = summarizeTreatments(all);
  const visible = all.filter((treatment) => filter === "all" || treatment.status === filter);
  const quoted = all.filter(
    (treatment) =>
      treatment.status === PERFORMED_PROCEDURE_STATUS.PLANNED ||
      treatment.status === PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
  );
  const showPrices = user ? canSeePrices(user.role) : false;
  const currency = clinic.data?.currency ?? "";

  const print = (): void => {
    setPrinting(true);
    requestAnimationFrame(() => window.print());
  };

  return (
    <div data-testid="treatment-plan-tab" className="flex flex-col gap-4">
      <p data-testid="treatment-plan-about" className="text-value text-ink-muted">
        {t("treatmentPlans.about")}
      </p>

      {showPrices && (
        <div data-testid="treatment-plan-summary" className="grid gap-3 sm:grid-cols-3">
          <StatCard
            data-testid="treatment-plan-total"
            label={t("treatmentPlans.total")}
            value={<Money amount={summary.total} currency={currency} />}
            caption={t("treatmentPlans.treatmentCount", { count: summary.count })}
            icon="clipboard"
            tone="primary"
          />
          <StatCard
            data-testid="treatment-plan-done"
            label={t("treatmentPlans.completedAmount")}
            value={<Money amount={summary.done} currency={currency} />}
            caption={t("treatmentPlans.progressCaption", {
              done: summary.completed,
              total: summary.count,
            })}
            icon="check"
            tone="success"
          />
          <StatCard
            data-testid="treatment-plan-remaining"
            label={t("treatmentPlans.remaining")}
            value={<Money amount={summary.remaining} currency={currency} />}
            icon="clock"
            tone="warning"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          data-testid="treatment-plan-filter"
          label={t("treatmentPlans.filterByStatus")}
          value={filter}
          onChange={setFilter}
          options={TREATMENT_FILTERS.map((option) => ({
            value: option,
            label: option === "all" ? t("common.all") : t(`chart.procedureStatus.${option}`),
            count: all.filter((treatment) => option === "all" || treatment.status === option)
              .length,
          }))}
        />

        {quoted.length > 0 && (
          <Button
            variant="secondary"
            icon={<Icon name="print" />}
            data-testid="treatment-plan-print"
            onClick={print}
          >
            {t("treatmentPlans.print")}
          </Button>
        )}
      </div>

      <TreatmentsPanel
        data-testid="treatment-plan-treatments"
        patientId={patientId}
        treatments={visible}
        defaults={{ status: PERFORMED_PROCEDURE_STATUS.PLANNED }}
        emptyTitle="treatmentPlans.empty"
        showTotal={false}
      />

      {printing && (
        <div data-testid="treatment-plan-print-root" className="print-root">
          <PlanPrint
            treatments={quoted}
            clinic={clinic.data}
            patientName={patient?.fullName ?? ""}
            fileNumber={patient?.fileNumber ?? ""}
            catalog={catalog.data ?? []}
          />
        </div>
      )}
    </div>
  );
}
