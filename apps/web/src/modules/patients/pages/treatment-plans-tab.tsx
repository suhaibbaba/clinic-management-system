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
import { Skeleton, SkeletonKpi, SkeletonStatus } from "@clinic/ui/components/skeleton";
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
  const { user, can } = useSession();
  const clinic = useClinic();
  const catalog = useProcedureCatalog();
  const treatments = usePatientProcedures(patientId);
  const showSkeleton = useDelayedLoading(treatments.isPending);
  const [filter, setFilter] = useTabParam<TreatmentFilter>("status", TREATMENT_FILTERS, "all");
  const [printing, setPrinting] = useState(false);

  const showPrices = user ? canSeePrices(can) : false;

  if (showSkeleton) {
    return <TreatmentPlanSkeleton showPrices={showPrices} />;
  }

  if (treatments.isPending) {
    return <></>;
  }

  if (treatments.isError) {
    return (
      <EmptyState
        icon="alert"
        data-testid="treatment-plan-error"
        title="errors.unknown"
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
        emptyTitle={filter === "all" ? "treatmentPlans.empty" : "treatmentPlans.noneWithStatus"}
        showTotal={false}
        layout="grid"
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

function TreatmentPlanSkeleton({ showPrices }: { readonly showPrices: boolean }): JSX.Element {
  return (
    <div data-testid="treatment-plan-loading" className="flex flex-col gap-4">
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>

      {showPrices ? <SkeletonKpi count={3} /> : <SkeletonStatus />}

      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((pill) => (
            <Skeleton key={pill} className="h-(--control-h-sm) w-20 rounded-pill" />
          ))}
        </div>
        <Skeleton className="h-(--control-h) w-24 rounded-control" />
      </div>

      <ul aria-hidden="true" className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <li
            key={card}
            className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-3"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-(--control-h-sm) w-16 rounded-pill" />
              <Skeleton className="size-(--control-h-sm) rounded-control" />
            </div>
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </li>
        ))}
      </ul>
    </div>
  );
}
