import {
  CHART_TYPE,
  LOOKUP_LIST,
  SYSTEM_LOOKUPS,
  type BodyRegionLocation,
  type PerformedProcedureStatus,
} from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  deriveRegionSummaries,
  regionKey,
  regionSlots,
  regionTone,
  treatedAt,
  treatmentRegions,
} from "@web/modules/patients/lib/chart/body-regions";
import { skeletonOutline } from "@web/modules/patients/lib/chart/skeleton-layout";
import { makeLookupOption, makeProcedure } from "@test/helpers/fixtures";

const onRegion = (
  id: string,
  location: BodyRegionLocation,
  status: PerformedProcedureStatus = "done",
) =>
  makeProcedure(0, {
    id,
    status,
    chartMarks: [
      {
        id: `mark-${id}`,
        clinicId: "clinic",
        performedProcedureId: id,
        chartType: CHART_TYPE.BODY_REGION,
        location,
        createdAt: "2026-02-01T09:00:00.000Z",
        updatedAt: "2026-02-01T09:00:00.000Z",
      },
    ],
  });

const region = (code: string, paired: boolean) =>
  makeLookupOption({ listKey: LOOKUP_LIST.BODY_REGION, code, meta: { paired } });

describe("body regions", () => {
  it("offers a paired region on both sides and a midline region once", () => {
    expect(regionSlots([region("knee", true), region("lumbar_spine", false)])).toEqual([
      { key: "knee:right", region: "knee", side: "right" },
      { key: "knee:left", region: "knee", side: "left" },
      { key: "lumbar_spine:midline", region: "lumbar_spine", side: "midline" },
    ]);
  });

  it("keys a mark without a side on the midline", () => {
    expect(regionKey("pelvis", undefined)).toBe("pelvis:midline");
  });

  it("reads only the body marks of a treatment", () => {
    expect(treatmentRegions(makeProcedure(46))).toEqual([]);
    expect(treatmentRegions(onRegion("a", { region: "knee", side: "left" }))).toEqual([
      { region: "knee", side: "left" },
    ]);
  });

  it("tells the left knee from the right", () => {
    const treatment = onRegion("a", { region: "knee", side: "left" });

    expect(treatedAt(treatment, { key: "knee:left" })).toBe(true);
    expect(treatedAt(treatment, { key: "knee:right" })).toBe(false);
  });

  it("marks a region treated once anything there is done, planned while all is planned", () => {
    const summaries = deriveRegionSummaries([
      onRegion("a", { region: "knee", side: "left" }, "done"),
      onRegion("b", { region: "knee", side: "left" }, "planned"),
      onRegion("c", { region: "shoulder", side: "right" }, "planned"),
      onRegion("d", { region: "hip", side: "right" }, "cancelled"),
      makeProcedure(46),
    ]);

    expect(summaries.get("knee:left")).toEqual({
      key: "knee:left",
      procedureCount: 2,
      tone: "treated",
    });
    expect(regionTone(summaries, "shoulder:right")).toBe("planned");
    expect(regionTone(summaries, "hip:right")).toBe("none");
    expect(summaries.size).toBe(2);
  });

  it("draws every built-in region on one of the two views, on each side it has", () => {
    const missing = regionSlots(
      SYSTEM_LOOKUPS[LOOKUP_LIST.BODY_REGION].map((row) =>
        makeLookupOption({
          listKey: LOOKUP_LIST.BODY_REGION,
          code: row.code,
          meta: row.meta ?? {},
        }),
      ),
    ).filter(
      (slot) =>
        skeletonOutline("front", slot.region, slot.side) === undefined &&
        skeletonOutline("back", slot.region, slot.side) === undefined,
    );

    expect(missing).toEqual([]);
  });

  it("draws the scapula on the back only and the sternum on the front only", () => {
    expect(skeletonOutline("front", "scapula", "left")).toBeUndefined();
    expect(skeletonOutline("back", "scapula", "left")).toBeDefined();
    expect(skeletonOutline("front", "sternum", "midline")).toBeDefined();
    expect(skeletonOutline("back", "sternum", "midline")).toBeUndefined();
  });

  it("has no drawing for a region a clinic added itself", () => {
    expect(skeletonOutline("front", "tailbone", "midline")).toBeUndefined();
    expect(skeletonOutline("back", "tailbone", "midline")).toBeUndefined();
  });
});
