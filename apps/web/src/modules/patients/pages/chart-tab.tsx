import { CHART_TYPE, type PatientClinicalView } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedControl, useTabParam } from "@clinic/ui";
import { BodyChartTab } from "@web/modules/patients/pages/body-chart-tab";
import { ToothChartTab } from "@web/modules/patients/pages/tooth-chart-tab";
import { patientCharts, type PatientChart } from "@web/modules/patients/lib/chart/charts";
import { useSession } from "@web/shared/providers/session";

export function ChartTab({
  patientId,
  dateOfBirth,
  patient,
}: {
  readonly patientId: string;
  readonly dateOfBirth?: string | null | undefined;
  readonly patient?: PatientClinicalView | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();

  const charts = patientCharts(user?.clinic.chartTypes ?? []);
  const [chart, setChart] = useTabParam<PatientChart>(
    "chart",
    charts,
    charts[0] ?? CHART_TYPE.TOOTH_FDI,
  );

  return (
    <div className="flex flex-col gap-5">
      {charts.length > 1 && (
        <SegmentedControl
          data-testid="chart-kind"
          label={t("chart.kind")}
          value={chart}
          onChange={setChart}
          options={charts.map((option) => ({ value: option, label: t(`chart.kinds.${option}`) }))}
        />
      )}

      {chart === CHART_TYPE.BODY_REGION ? (
        <BodyChartTab patientId={patientId} />
      ) : (
        <ToothChartTab patientId={patientId} dateOfBirth={dateOfBirth} patient={patient} />
      )}
    </div>
  );
}
