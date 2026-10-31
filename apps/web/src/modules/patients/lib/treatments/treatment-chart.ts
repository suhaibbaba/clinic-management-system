import {
  CHART_TYPE,
  type ChartType,
  type PerformedProcedure,
  type ProcedureCatalogItem,
  type Specialty,
} from "@clinic/shared";

export interface TreatmentChartContext {
  readonly specialties: readonly Pick<Specialty, "id" | "chartType">[];
  readonly clinicCharts: readonly ChartType[];
  readonly defaults: { readonly tooth?: number | undefined; readonly region?: unknown };
  readonly treatment?: Pick<PerformedProcedure, "chartMarks"> | undefined;
}

export function procedureChartType(
  item: Pick<ProcedureCatalogItem, "specialtyId"> | undefined,
  context: TreatmentChartContext,
): ChartType {
  const specialty = item && context.specialties.find((entry) => entry.id === item.specialtyId);

  if (specialty) {
    return specialty.chartType;
  }

  const marked = context.treatment?.chartMarks?.[0]?.chartType;

  if (marked) {
    return marked;
  }

  if (context.defaults.region !== undefined) {
    return CHART_TYPE.BODY_REGION;
  }

  if (context.defaults.tooth !== undefined) {
    return CHART_TYPE.TOOTH_FDI;
  }

  return context.clinicCharts.includes(CHART_TYPE.BODY_REGION) &&
    !context.clinicCharts.includes(CHART_TYPE.TOOTH_FDI)
    ? CHART_TYPE.BODY_REGION
    : CHART_TYPE.TOOTH_FDI;
}
