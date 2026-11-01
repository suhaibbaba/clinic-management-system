import type { DoctorSettlement, PayrollLine, SettlementTreatment } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { paySteps } from "@web/modules/payroll/lib/pay-steps";
import { DOCTOR_ID } from "@test/helpers/fixtures";

const PATIENT_A = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";

function treatment(
  patientId: string,
  revenue: string,
  collectedPercent: number,
  discount = "0.00",
): SettlementTreatment {
  const doctorShare = (Number(revenue) / 2).toFixed(2);
  const payable = ((Number(doctorShare) * collectedPercent) / 100).toFixed(2);

  return {
    id: `${patientId.slice(0, 8)}-0000-4000-8000-${revenue.replace(".", "").padStart(12, "0")}`,
    doctorId: DOCTOR_ID,
    performedAt: "2026-10-08T10:00:00.000Z",
    patientId,
    patientName: "مريض",
    fileNumber: null,
    procedureName: "Scaling",
    price: (Number(revenue) + Number(discount)).toFixed(2),
    discount,
    revenue,
    taxPercent: 0,
    tax: "0.00",
    overheadPercent: 0,
    overhead: "0.00",
    suggestedMaterialCost: "0.00",
    materialCost: "0.00",
    materialCostSet: false,
    workPercent: 100,
    split: null,
    clinicSharePercent: 50,
    clinicSharePercentSet: false,
    net: revenue,
    clinicShare: doctorShare,
    doctorShare,
    waivedReason: null,
    collectedPercent,
    payable,
    paid: "0.00",
    outstanding: payable,
    status: "unpaid",
  };
}

function settlement(treatments: SettlementTreatment[]): DoctorSettlement {
  const sum = (pick: (row: SettlementTreatment) => string) =>
    treatments.reduce((total, row) => total + Number(pick(row)), 0).toFixed(2);

  return {
    doctorId: DOCTOR_ID,
    from: "2026-10-01",
    to: "2026-10-31",
    clinicSharePercent: 50,
    clinicShareOwn: 50,
    clinicShareDefault: 0,
    onPercentage: true,
    basis: "collected",
    labCostBearer: "shared",
    totals: {
      revenue: sum((row) => row.revenue),
      tax: "0.00",
      overhead: "0.00",
      materials: "0.00",
      net: sum((row) => row.net),
      clinicShare: sum((row) => row.clinicShare),
      doctorShare: sum((row) => row.doctorShare),
      payable: sum((row) => row.payable),
      paid: "0.00",
      outstanding: sum((row) => row.payable),
    },
    treatments,
    payouts: [],
    collector: "clinic",
    earned: sum((row) => row.payable),
    paid: "0.00",
    held: "0.00",
    remitted: "0.00",
    balance: sum((row) => row.payable),
  } as DoctorSettlement;
}

const line = (overrides: Partial<PayrollLine> = {}): PayrollLine =>
  ({
    plan: "percentage",
    base: "0.00",
    extras: "0.00",
    cuts: "0.00",
    received: "0.00",
    owed: "225.00",
    collector: "clinic",
    held: "0.00",
    remitted: "0.00",
    payments: [],
    remittances: [],
    ...overrides,
  }) as PayrollLine;

describe("paySteps", () => {
  const month = settlement([
    treatment(PATIENT_A, "200.00", 100),
    treatment(PATIENT_A, "250.00", 100),
    treatment(PATIENT_B, "1590.00", 0),
    treatment("33333333-3333-4333-8333-333333333333", "0.00", 100),
  ]);

  it("walks from the prices to what patients paid, then to what is left to pay", () => {
    const { steps, owed } = paySteps(line(), month);

    expect(steps.map((step) => [step.key, step.amount])).toEqual([
      ["prices", "2040.00"],
      ["share", "1020.00"],
      ["collected", "450.00"],
      ["collectedShare", "225.00"],
      ["paidOut", "0.00"],
    ]);
    expect(owed).toBe("225.00");
  });

  it("counts each patient who paid once and names what is still unpaid", () => {
    const collected = paySteps(line(), month).steps.find((step) => step.key === "collected");

    expect(collected?.values).toEqual({ count: 1, total: "2040.00", unpaid: "1590.00" });
  });

  it("shows the price before discount only when a patient was given one", () => {
    const plain = paySteps(line(), month).steps[0];
    const discounted = paySteps(line(), settlement([treatment(PATIENT_A, "180.00", 100, "20.00")]))
      .steps[0];

    expect(plain?.parts).toBeUndefined();
    expect(discounted?.parts).toEqual([
      { key: "prices", amount: "200.00" },
      { key: "discount", amount: "20.00" },
    ]);
  });

  it("skips the patient steps when the share is paid on treatments done", () => {
    const keys = paySteps(line(), { ...month, basis: "done" }).steps.map((step) => step.key);

    expect(keys).toEqual(["prices", "share", "paidOut"]);
  });

  it("adds the salary, bonus and deduction for a doctor on salary and percentage", () => {
    const keys = paySteps(
      line({ plan: "salary_and_percentage", base: "3000.00", extras: "100.00", cuts: "50.00" }),
      month,
    ).steps.map((step) => step.key);

    expect(keys).toEqual([
      "prices",
      "share",
      "collected",
      "collectedShare",
      "salary",
      "bonus",
      "deduction",
      "paidOut",
    ]);
  });

  it("counts what the doctor took from patients as paid to them, and says what they owe", () => {
    const { steps, owed, owesClinic } = paySteps(
      line({ collector: "doctor", held: "450.00", received: "450.00", owed: "-225.00" }),
      month,
    );

    expect(steps.slice(-2).map((step) => [step.key, step.amount])).toEqual([
      ["paidOut", "0.00"],
      ["held", "450.00"],
    ]);
    expect({ owed, owesClinic }).toEqual({ owed: "225.00", owesClinic: true });
  });

  it("shows what the doctor handed to the clinic", () => {
    const { steps, owed, owesClinic } = paySteps(
      line({
        collector: "doctor",
        held: "450.00",
        remitted: "225.00",
        received: "225.00",
        owed: "0.00",
        remittances: [{ id: "r1" } as PayrollLine["remittances"][number]],
      }),
      month,
    );

    expect(steps.slice(-3).map((step) => [step.key, step.amount])).toEqual([
      ["paidOut", "0.00"],
      ["held", "450.00"],
      ["remitted", "225.00"],
    ]);
    expect({ owed, owesClinic }).toEqual({ owed: "0.00", owesClinic: false });
  });
});
