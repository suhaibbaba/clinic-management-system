import { describe, expect, it } from "vitest";
import { treatmentNet } from "@web/modules/payroll/lib/treatment-net";

describe("treatmentNet", () => {
  it("shows how the lab cost takes a treatment's amount down to the net", () => {
    expect(
      treatmentNet({
        revenue: "2483.00",
        tax: "0.00",
        overhead: "0.00",
        net: "150.00",
        clinicSharePercent: 50,
      }),
    ).toEqual({
      deductions: [{ key: "materials", amount: "2333.00" }],
      net: "150.00",
      doctorPercent: 50,
    });
  });

  it("lists tax and overhead before the lab and materials", () => {
    const result = treatmentNet({
      revenue: "1000.00",
      tax: "200.00",
      overhead: "100.00",
      net: "600.00",
      clinicSharePercent: 40,
    });

    expect(result.deductions.map((deduction) => deduction.key)).toEqual([
      "tax",
      "overhead",
      "materials",
    ]);
    expect(result.deductions[2]?.amount).toBe("100.00");
    expect(result.doctorPercent).toBe(60);
  });

  it("has nothing to explain when nothing comes off", () => {
    expect(
      treatmentNet({
        revenue: "300.00",
        tax: "0.00",
        overhead: "0.00",
        net: "300.00",
        clinicSharePercent: 0,
      }).deductions,
    ).toEqual([]);
  });
});
