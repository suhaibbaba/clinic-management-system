import { CHART_TYPE } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { procedureChartType } from "@web/modules/patients/lib/treatments/treatment-chart";
import { makeProcedure } from "@test/helpers/fixtures";

const specialties = [
  { id: "dental", chartType: CHART_TYPE.TOOTH_FDI },
  { id: "ortho", chartType: CHART_TYPE.BODY_REGION },
  { id: "physio", chartType: CHART_TYPE.NONE },
];

const context = (overrides = {}) => ({
  specialties,
  clinicCharts: [CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION],
  defaults: {},
  ...overrides,
});

describe("procedureChartType", () => {
  it("follows the specialty of the chosen procedure", () => {
    expect(procedureChartType({ specialtyId: "ortho" }, context())).toBe(CHART_TYPE.BODY_REGION);
    expect(procedureChartType({ specialtyId: "dental" }, context())).toBe(CHART_TYPE.TOOTH_FDI);
    expect(procedureChartType({ specialtyId: "physio" }, context())).toBe(CHART_TYPE.NONE);
  });

  it("follows where the form was opened from until a procedure is chosen", () => {
    expect(procedureChartType(undefined, context({ defaults: { region: {} } }))).toBe(
      CHART_TYPE.BODY_REGION,
    );
    expect(procedureChartType(undefined, context({ defaults: { tooth: 36 } }))).toBe(
      CHART_TYPE.TOOTH_FDI,
    );
  });

  it("keeps an edited treatment on the chart it was recorded on", () => {
    expect(
      procedureChartType(undefined, context({ treatment: makeProcedure(46), specialties: [] })),
    ).toBe(CHART_TYPE.TOOTH_FDI);
  });

  it("opens on the body chart in a clinic that has no teeth to chart", () => {
    expect(procedureChartType(undefined, context({ clinicCharts: [CHART_TYPE.BODY_REGION] }))).toBe(
      CHART_TYPE.BODY_REGION,
    );
  });
});
