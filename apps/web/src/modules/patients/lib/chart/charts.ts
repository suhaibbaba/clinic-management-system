import {
  CHART_TYPE,
  TIMELINE_ENTRY_TYPE,
  chartGlyph,
  type ChartType,
  type TimelineEntryType,
} from "@clinic/shared";
import type { IconName } from "@clinic/ui";
import { TIMELINE_ENTRY_ICONS } from "@web/modules/patients/constants";

export type PatientChart = typeof CHART_TYPE.TOOTH_FDI | typeof CHART_TYPE.BODY_REGION;

const CHART_ORDER: readonly PatientChart[] = [CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION];

export function patientCharts(chartTypes: readonly ChartType[]): PatientChart[] {
  return CHART_ORDER.filter((chart) => chartTypes.includes(chart));
}

function onlyChart(chartTypes: readonly ChartType[]): PatientChart | undefined {
  const charts = patientCharts(chartTypes);

  return charts.length === 1 ? charts[0] : undefined;
}

export function procedureIcon(chartTypes: readonly ChartType[]): IconName {
  return chartGlyph(chartTypes) ?? "activity";
}

export function timelineEntryIcon(
  type: TimelineEntryType,
  chartTypes: readonly ChartType[],
): IconName {
  return type === TIMELINE_ENTRY_TYPE.PROCEDURE
    ? procedureIcon(chartTypes)
    : TIMELINE_ENTRY_ICONS[type];
}

export function chartTabLabel(chartTypes: readonly ChartType[]): string {
  const chart = onlyChart(chartTypes);

  return chart ? `patients.tabs.charts.${chart}` : "patients.tabs.chart";
}
