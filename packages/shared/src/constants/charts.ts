import { CHART_TYPE, type ChartType } from "@shared/enums";

export const CHART_GLYPHS = {
  [CHART_TYPE.TOOTH_FDI]: "tooth",
  [CHART_TYPE.BODY_REGION]: "bone",
} as const;
export type ChartGlyph = (typeof CHART_GLYPHS)[keyof typeof CHART_GLYPHS];

export function chartGlyph(chartTypes: readonly ChartType[]): ChartGlyph | null {
  const glyphs = [
    ...new Set(
      chartTypes.flatMap((chart) => (chart === CHART_TYPE.NONE ? [] : [CHART_GLYPHS[chart]])),
    ),
  ];

  return glyphs.length === 1 ? (glyphs[0] ?? null) : null;
}
