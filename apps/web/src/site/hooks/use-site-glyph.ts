import { chartGlyph, type ChartGlyph } from "@clinic/shared";
import { useSite } from "@web/site/hooks/use-site";

export function useSiteGlyph(): ChartGlyph | "stethoscope" {
  const { site } = useSite();

  return chartGlyph(site.clinic.chartTypes) ?? "stethoscope";
}
