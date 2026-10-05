import { describe, expect, it } from "vitest";
import { describeItem } from "@web/modules/patients/lib/prescriptions";

describe("describeItem", () => {
  it("isolates the shorthand so a right-to-left line keeps it in order", () => {
    expect(describeItem({ drug: "Amoxicillin 500 mg", perDose: 1, timesPerDay: 2, days: 7 })).toBe(
      "⁦1×2×7⁩",
    );
  });

  it("keeps the free text an older prescription was written with", () => {
    expect(
      describeItem({ drug: "Ibuprofen", dose: "400 mg", frequency: "BID", duration: "5 أيام" }),
    ).toBe("400 mg · BID · 5 أيام");
  });
});
