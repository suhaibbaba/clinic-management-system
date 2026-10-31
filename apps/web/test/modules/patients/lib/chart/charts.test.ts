import { CHART_TYPE } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { patientCharts } from "@web/modules/patients/lib/chart/charts";

describe("patientCharts", () => {
  it("offers the teeth before the body, once each", () => {
    expect(patientCharts([CHART_TYPE.BODY_REGION, CHART_TYPE.NONE, CHART_TYPE.TOOTH_FDI])).toEqual([
      CHART_TYPE.TOOTH_FDI,
      CHART_TYPE.BODY_REGION,
    ]);
  });

  it("offers no chart to a clinic whose specialties draw none", () => {
    expect(patientCharts([CHART_TYPE.NONE])).toEqual([]);
    expect(patientCharts([])).toEqual([]);
  });
});
