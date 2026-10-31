import { PERFORMED_PROCEDURE_STATUS } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Drawer } from "@clinic/ui";
import { SkeletonTimeline } from "@clinic/ui/components/skeleton";
import { TreatmentsPanel } from "@web/modules/patients/components/treatments/treatments-panel";
import { usePatientProcedures } from "@web/modules/patients/queries";
import { treatedAt, type RegionSlot } from "@web/modules/patients/lib/chart/body-regions";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";

export interface RegionPanelProps {
  readonly patientId: string;
  readonly slot: RegionSlot | null;
  readonly label: string;
  readonly onClose: () => void;
}

export function RegionPanel({ patientId, slot, label, onClose }: RegionPanelProps): JSX.Element {
  const { t } = useTranslation();

  const { data, isPending, isError } = usePatientProcedures(patientId);
  const atRegion =
    slot === null ? [] : (data ?? []).filter((treatment) => treatedAt(treatment, slot));
  const showSkeleton = useDelayedLoading(isPending);

  return (
    <Drawer
      data-testid="region-panel"
      open={slot !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      descriptionKey="chart.body.panel.description"
      title={
        <span className="flex items-center gap-2">
          {label}
          <Badge tone={atRegion.length > 0 ? "info" : "neutral"} data-testid="region-panel-count">
            {t("chart.panel.procedureCount", { count: atRegion.length })}
          </Badge>
        </span>
      }
    >
      <section className="flex flex-col gap-2">
        <h3 className="text-label font-semibold text-ink">{t("chart.body.panel.history")}</h3>

        {showSkeleton && <SkeletonTimeline entries={2} />}
        {isError && (
          <p data-testid="region-panel-error" className="text-value text-danger-600">
            {t("errors.unknown")}
          </p>
        )}

        {data && slot !== null && (
          <TreatmentsPanel
            data-testid="region-panel-treatments"
            patientId={patientId}
            treatments={atRegion}
            defaults={{
              region: { region: slot.region, side: slot.side },
              status: PERFORMED_PROCEDURE_STATUS.PLANNED,
            }}
            emptyTitle="chart.body.panel.noProcedures"
          />
        )}
      </section>
    </Drawer>
  );
}
