import { describe, expect, it } from "vitest";
import {
  nextStatuses,
  statusChoices,
  summarizeTreatments,
  treatmentTeeth,
  treatmentsTotal,
} from "@web/modules/patients/lib/treatments/treatments";
import { makeProcedure } from "@test/helpers/fixtures";

describe("treatments", () => {
  it("offers planned, in progress and done for a new treatment", () => {
    expect(statusChoices(undefined)).toEqual(["planned", "in_progress", "done"]);
  });

  it("offers only the moves the state machine allows for an existing one", () => {
    expect(statusChoices("planned")).toEqual(["planned", "in_progress", "done", "cancelled"]);
    expect(statusChoices("done")).toEqual(["done"]);
    expect(nextStatuses("done")).toEqual([]);
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

  it("summarises what the patient's treatment plan costs, has cost and still costs", () => {
    const summary = summarizeTreatments([
      makeProcedure(16, { price: "100.00", discount: "10.00", status: "done" }),
      makeProcedure(17, { price: "60.00", discount: "0.00", status: "in_progress" }),
      makeProcedure(18, { price: "40.00", discount: "0.00", status: "planned" }),
      makeProcedure(19, { price: "999.00", discount: "0.00", status: "cancelled" }),
    ]);

    expect(summary).toEqual({
      total: "190.00",
      done: "90.00",
      remaining: "100.00",
      count: 3,
      completed: 1,
    });
  });
});
