import { describe, expect, it } from "vitest";
import { currentMonth, isMonth, shiftMonth } from "@web/modules/payroll/lib/months";

describe("payroll months", () => {
  it("steps across a year", () => {
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-03", 0)).toBe("2025-03");
  });

  it("reads the month of a day", () => {
    expect(currentMonth("2026-10-01")).toBe("2026-10");
  });

  it("accepts only a real month", () => {
    expect(isMonth("2025-03")).toBe(true);
    expect(isMonth("2025-13")).toBe(false);
    expect(isMonth("2025-3")).toBe(false);
  });
});
