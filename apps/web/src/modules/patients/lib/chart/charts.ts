import { CHART_TYPE, type ChartType } from "@clinic/shared";

export type PatientChart = typeof CHART_TYPE.TOOTH_FDI | typeof CHART_TYPE.BODY_REGION;

const CHART_ORDER: readonly PatientChart[] = [CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION];

export function patientCharts(chartTypes: readonly ChartType[]): PatientChart[] {
  return CHART_ORDER.filter((chart) => chartTypes.includes(chart));
}
