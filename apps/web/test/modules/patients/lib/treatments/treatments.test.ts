import { describe, expect, it } from "vitest";
import {
  nextStatuses,
  statusChoices,
  treatmentTeeth,
  treatmentsTotal,
} from "@web/modules/patients/lib/treatments/treatments";
import { isOpenPlan } from "@web/modules/patients/lib/treatments/plans";
import { makeProcedure } from "@test/helpers/fixtures";

describe("treatments", () => {
  it("offers planned, in progress and done for a new treatment", () => {
    expect(statusChoices(undefined)).toEqual(["planned", "in_progress", "done"]);
  });

  it("offers only the moves the state machine allows for an existing one", () => {
    expect(statusChoices("planned")).toEqual(["planned", "in_progress", "done", "cancelled"]);
    expect(statusChoices("done")).toEqual(["done", "in_progress"]);
    expect(nextStatuses("cancelled")).toEqual(["planned"]);
  });

  it("totals the net price of everything but cancelled treatments, exactly", () => {
    const treatments = [
      makeProcedure(16, { price: "0.10", discount: "0.00", status: "done" }),
      makeProcedure(17, { price: "0.30", discount: "0.10", status: "planned" }),
      makeProcedure(18, { price: "500.00", discount: "0.00", status: "cancelled" }),
    ];

    expect(treatmentsTotal(treatments)).toBe("0.30");
    expect(treatmentsTotal([])).toBe("0.00");
  });

  it("reads the teeth a treatment is charted on", () => {
    expect(treatmentTeeth(makeProcedure(46))).toEqual([46]);
    expect(treatmentTeeth(makeProcedure(46, { chartMarks: [] }))).toEqual([]);
  });

  it("treats draft and active plans as open", () => {
    expect(isOpenPlan({ status: "draft" })).toBe(true);
    expect(isOpenPlan({ status: "active" })).toBe(true);
    expect(isOpenPlan({ status: "completed" })).toBe(false);
    expect(isOpenPlan({ status: "cancelled" })).toBe(false);
  });
});
