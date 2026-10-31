import { CHART_TYPE, TIMELINE_ENTRY_TYPE } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  chartTabLabel,
  patientCharts,
  procedureIcon,
  timelineEntryIcon,
} from "@web/modules/patients/lib/chart/charts";

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

describe("procedureIcon", () => {
  it("draws the clinic's one chart", () => {
    expect(procedureIcon([CHART_TYPE.TOOTH_FDI])).toBe("tooth");
    expect(procedureIcon([CHART_TYPE.BODY_REGION, CHART_TYPE.NONE])).toBe("bone");
  });

  it("draws neither a tooth nor a bone for several charts or none", () => {
    expect(procedureIcon([CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION])).toBe("activity");
    expect(procedureIcon([])).toBe("activity");
  });
});

describe("timelineEntryIcon", () => {
  it("gives a procedure the chart's icon and leaves the rest alone", () => {
    expect(timelineEntryIcon(TIMELINE_ENTRY_TYPE.PROCEDURE, [CHART_TYPE.BODY_REGION])).toBe("bone");
    expect(timelineEntryIcon(TIMELINE_ENTRY_TYPE.VISIT, [CHART_TYPE.BODY_REGION])).toBe(
      "stethoscope",
    );
  });
});

describe("chartTabLabel", () => {
  it("names the one chart, and only says chart when there are several", () => {
    expect(chartTabLabel([CHART_TYPE.BODY_REGION])).toBe("patients.tabs.charts.body_region");
    expect(chartTabLabel([CHART_TYPE.TOOTH_FDI])).toBe("patients.tabs.charts.tooth_fdi");
    expect(chartTabLabel([CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION])).toBe(
      "patients.tabs.chart",
    );
  });
});
