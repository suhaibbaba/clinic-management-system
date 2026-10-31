import { LOOKUP_LIST } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@clinic/ui";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";
import { BodyChart, BodyChartSkeleton } from "@web/modules/patients/components/chart/body-chart";
import { RegionPanel } from "@web/modules/patients/components/chart/region-panel";
import { useRegionLabel } from "@web/modules/patients/hooks/use-region-label";
import {
  deriveRegionSummaries,
  regionSlots,
  type RegionSlot,
} from "@web/modules/patients/lib/chart/body-regions";
import { usePatientProcedures } from "@web/modules/patients/queries";
import { useLookupList } from "@web/shared/queries/lookups";
import { useSession } from "@web/shared/providers/session";

export function BodyChartTab({ patientId }: { readonly patientId: string }): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const [selected, setSelected] = useState<RegionSlot | null>(null);

  const procedures = usePatientProcedures(patientId);
  const regions = useLookupList(LOOKUP_LIST.BODY_REGION);
  const label = useRegionLabel();
  const showSkeleton = useDelayedLoading(procedures.isPending);

  const slots = useMemo(() => regionSlots(regions), [regions]);
  const summaries = useMemo(() => deriveRegionSummaries(procedures.data ?? []), [procedures.data]);

  if (procedures.isPending) {
    return showSkeleton ? <BodyChartSkeleton /> : <></>;
  }

  if (procedures.isError) {
    return (
      <EmptyState
        icon="alert"
        data-testid="body-chart-error"
        title="errors.unknown"
        hint="chart.loadFailed"
      />
    );
  }

  return (
    <div data-testid="body-chart-tab" className="flex flex-col gap-5">
      <p data-testid="body-chart-keyboard-hint" className="ms-auto text-label text-ink-muted">
        {t("chart.body.keyboardHint")}
      </p>

      {summaries.size === 0 && (
        <EmptyState
          icon="activity"
          data-testid="body-chart-empty"
          title="chart.empty"
          hint="chart.body.emptyHint"
        />
      )}

      <BodyChart
        slots={slots}
        summaries={summaries}
        selectedKey={selected?.key ?? null}
        label={label}
        onSelect={setSelected}
      />

      {user?.role && (
        <RegionPanel
          patientId={patientId}
          slot={selected}
          label={selected ? label(selected) : ""}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
