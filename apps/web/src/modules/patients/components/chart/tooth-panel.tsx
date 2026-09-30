import type { PerformedProcedure } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Drawer, Icon, Ltr } from "@clinic/ui";
import { SkeletonTimeline } from "@clinic/ui/components/skeleton";
import { SurfaceSelector } from "@web/modules/patients/components/chart/surface-selector";
import { TreatmentsPanel } from "@web/modules/patients/components/treatments/treatments-panel";
import { type ToothSummary } from "@web/shared/lib/tooth-state";
import { useToothStates } from "@web/shared/hooks/use-tooth-states";
import { useToothHistory } from "@web/modules/patients/queries";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";

export interface ToothPanelProps {
  readonly patientId: string;
  readonly tooth: number | null;
  readonly summary: ToothSummary | null;
  readonly onClose: () => void;
  readonly onSendToLab?:
    ((input: { teeth: number[]; performedProcedureId?: string }) => void) | undefined;
}

export function ToothPanel({
  patientId,
  tooth,
  summary,
  onClose,
  onSendToLab,
}: ToothPanelProps): JSX.Element {
  const { t } = useTranslation();
  const states = useToothStates();

  const { data, isPending, isError } = useToothHistory(patientId, tooth);
  const showSkeleton = useDelayedLoading(isPending);

  return (
    <Drawer
      data-testid="tooth-panel"
      open={tooth !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      descriptionKey="chart.panel.description"
      title={
        <span className="flex items-center gap-2">
          {t("chart.panel.title")}
          <Ltr className="font-mono">{tooth}</Ltr>
          {summary && (
            <Badge tone="neutral" data-testid="tooth-panel-state">
              {states.info(summary.state).label}
            </Badge>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        {summary && (
          <section
            data-testid="tooth-panel-summary"
            className="rounded-card border border-line bg-canvas p-4 shadow-float"
          >
            <div className="flex items-center gap-3">
              <Ltr className="inline-flex size-12 shrink-0 items-center justify-center rounded-panel bg-surface font-mono text-section font-medium text-ink shadow-pill">
                {tooth}
              </Ltr>

              <div className="min-w-0">
                <p className="text-label text-ink-muted">{t("chart.panel.title")}</p>
                <p className="text-value font-medium text-ink">
                  {states.info(summary.state).label}
                </p>
              </div>

              <Badge
                className="ms-auto"
                data-testid="tooth-panel-count"
                tone={summary.surfaces.length > 0 ? "info" : "neutral"}
              >
                {t("chart.panel.procedureCount", { count: data?.procedures.length ?? 0 })}
              </Badge>
            </div>

            {summary.surfaces.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="mb-2 text-label font-semibold text-ink-muted">
                  {t("chart.panel.surfaces")}
                </h3>
                <SurfaceSelector value={summary.surfaces} readOnly />
              </div>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-label font-semibold text-ink">{t("chart.panel.history")}</h3>

            {onSendToLab && tooth !== null && (
              <Button
                icon={<Icon name="clipboard" />}
                size="sm"
                variant="secondary"
                data-testid="tooth-panel-send-to-lab"
                onClick={() => onSendToLab({ teeth: [tooth] })}
              >
                {t("labs.sendToLab")}
              </Button>
            )}
          </div>

          {showSkeleton && <SkeletonTimeline entries={2} />}
          {isError && (
            <p data-testid="tooth-panel-error" className="text-value text-danger-600">
              {t("errors.generic")}
            </p>
          )}

          {data && tooth !== null && (
            <TreatmentsPanel
              data-testid="tooth-panel-treatments"
              patientId={patientId}
              treatments={data.procedures}
              defaults={{ tooth }}
              emptyTitle="chart.panel.noProcedures"
              showPlan
              {...(onSendToLab && {
                onSendToLab: (treatment: PerformedProcedure) =>
                  onSendToLab({ teeth: [tooth], performedProcedureId: treatment.id }),
              })}
            />
          )}
        </section>
      </div>
    </Drawer>
  );
}
