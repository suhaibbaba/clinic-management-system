import { describe, expect, it } from "vitest";
import { createPrescriptionSchema, readDrugRegimen, regimenShorthand } from "@clinic/shared";
import {
  EMPTY_REGIMEN_INPUT,
  toRegimen,
  toRegimenInput,
  withDrugNote,
  withRegimen,
} from "@web/shared/lib/regimen";

describe("drug regimen", () => {
  it("reads typed numbers, Arabic digits and an Arabic decimal separator", () => {
    expect(toRegimen({ perDose: "١٫٥", timesPerDay: "٢", days: "7" })).toEqual({
      perDose: 1.5,
      timesPerDay: 2,
      days: 7,
    });
    expect(toRegimen(EMPTY_REGIMEN_INPUT)).toEqual({
      perDose: null,
      timesPerDay: null,
      days: null,
    });
  });

  it("round-trips through the form", () => {
    expect(toRegimenInput({ perDose: 0.5, timesPerDay: 3, days: null })).toEqual({
      perDose: "0.5",
      timesPerDay: "3",
      days: "",
    });
  });

  it("writes the doctor's shorthand, marking a missing part", () => {
    expect(regimenShorthand({ perDose: 1, timesPerDay: 2, days: 7 })).toBe("1×2×7");
    expect(regimenShorthand({ perDose: 1, days: 5 })).toBe("1×–×5");
    expect(regimenShorthand({})).toBeNull();
  });

  it("replaces the regimen in an option's meta and keeps everything else", () => {
    expect(
      withRegimen(
        { perDose: 2, days: 3, other: "kept" },
        { perDose: 1, timesPerDay: 2, days: null },
      ),
    ).toEqual({ other: "kept", perDose: 1, timesPerDay: 2 });
  });

  it("ignores a malformed regimen stored on an option", () => {
    expect(readDrugRegimen({ perDose: "a lot" })).toEqual({});
    expect(readDrugRegimen(undefined)).toEqual({});
  });

  it("needs the number of days, unless an older item carries its duration as text", () => {
    const base = { patientId: crypto.randomUUID(), doctorId: crypto.randomUUID() };

    expect(
      createPrescriptionSchema.safeParse({ ...base, items: [{ drug: "Ibuprofen 400 mg" }] })
        .success,
    ).toBe(false);
    expect(
      createPrescriptionSchema.safeParse({
        ...base,
        items: [{ drug: "Ibuprofen 400 mg", perDose: 1, timesPerDay: 3, days: 5 }],
      }).success,
    ).toBe(true);
    expect(
      createPrescriptionSchema.safeParse({
        ...base,
        items: [{ drug: "Ibuprofen 400 mg", duration: "5 أيام" }],
      }).success,
    ).toBe(true);
  });

  it("keeps a drug's note beside its regimen, and drops it when cleared", () => {
    expect(withDrugNote({ days: 7 }, "  بعد الأكل ")).toEqual({ days: 7, note: "بعد الأكل" });
    expect(withDrugNote({ days: 7, note: "بعد الأكل" }, " ")).toEqual({ days: 7 });
  });
});
