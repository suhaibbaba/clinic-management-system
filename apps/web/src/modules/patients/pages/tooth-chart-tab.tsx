import { isDeciduousTooth, type PerformedProcedure } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, SegmentedControl } from "@clinic/ui";
import type { Dentition } from "@web/modules/patients/lib/chart/fdi-layout";
import { ToothChart, ToothChartSkeleton } from "@web/modules/patients/components/chart/tooth-chart";
import { ToothLegend } from "@web/modules/patients/components/chart/tooth-legend";
import { ToothPanel } from "@web/modules/patients/components/chart/tooth-panel";
import { deriveToothSummaries, healthyTooth } from "@web/shared/lib/tooth-state";
import { useToothStates } from "@web/shared/hooks/use-tooth-states";
import { useProcedureCatalog, usePatientProcedures } from "@web/modules/patients/queries";
import { useSession } from "@web/shared/providers/session";
import { useLocalized } from "@web/shared/hooks/use-localized";
import { ageInYears } from "@web/modules/patients/lib/age";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";
import { PERMANENT_DENTITION_AGE } from "@web/modules/patients/constants";

export function ToothChartTab({
  patientId,
  dateOfBirth,
}: {
  readonly patientId: string;
  readonly dateOfBirth?: string | null | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();

  const [dentition, setDentition] = useState<Dentition>("permanent");
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const text = useLocalized();

  const procedures = usePatientProcedures(patientId);
  const catalog = useProcedureCatalog();
  const showSkeleton = useDelayedLoading(procedures.isPending || catalog.isPending);

  const outcomes = useMemo(
    () => new Map((catalog.data ?? []).map((item) => [item.id, item.chartOutcome])),
    [catalog.data],
  );

  const states = useToothStates();

  const summaries = useMemo(
    () => deriveToothSummaries(procedures.data ?? [], outcomes, states),
    [procedures.data, outcomes, states],
  );

  const procedureName = (treatment: PerformedProcedure): string =>
    text(catalog.data?.find((item) => item.id === treatment.procedureId)?.name) ||
    t("chart.panel.procedure");

  const age = dateOfBirth ? ageInYears(dateOfBirth) : null;
  const hasDeciduousHistory = [...summaries.keys()].some(isDeciduousTooth);
  const showDentitionToggle = age === null || age < PERMANENT_DENTITION_AGE || hasDeciduousHistory;

  if (procedures.isPending || catalog.isPending) {
    return showSkeleton ? (
      <div data-testid="chart-tab-loading" className="flex flex-col gap-4">
        <ToothChartSkeleton />
      </div>
    ) : (
      <></>
    );
  }

  if (procedures.isError) {
    return (
      <EmptyState
        icon="alert"
        data-testid="chart-error"
        title="errors.unknown"
        hint="chart.loadFailed"
      />
    );
  }

  const role = user?.role;
  const hasHistory = summaries.size > 0;

  return (
    <div data-testid="chart-tab" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showDentitionToggle && (
          <SegmentedControl
            data-testid="chart-dentition"
            label={t("chart.dentition")}
            value={dentition}
            onChange={(next) => {
              setDentition(next);
              setSelectedTooth(null);
            }}
            options={(["permanent", "deciduous"] as const).map((option) => ({
              value: option,
              label: t(`chart.${option}`),
            }))}
          />
        )}

        <p data-testid="chart-keyboard-hint" className="ms-auto text-label text-ink-muted">
          {t("chart.keyboardHint")}
        </p>
      </div>

      {!hasHistory && (
        <EmptyState
          icon="tooth"
          data-testid="chart-empty"
          title="chart.empty"
          hint="chart.emptyHint"
        />
      )}

      <div className="flex flex-col gap-3">
        <ToothChart
          dentition={dentition}
          summaries={summaries}
          selectedTooth={selectedTooth}
          onSelect={setSelectedTooth}
        />

        <ToothLegend />
      </div>

      {role && (
        <ToothPanel
          patientId={patientId}
          tooth={selectedTooth}
          summary={
            selectedTooth === null
              ? null
              : (summaries.get(selectedTooth) ?? healthyTooth(selectedTooth))
          }
          onClose={() => setSelectedTooth(null)}
          procedureName={procedureName}
        />
      )}
    </div>
  );
}
