import type { SettlementTotals, SettlementTreatment } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { groupByCollection, shareSplit, sumMoney } from "@web/modules/payroll/lib/share-groups";
import { DOCTOR_ID } from "@test/helpers/fixtures";

function treatment(
  id: string,
  revenue: string,
  collectedPercent: number,
  overrides: Partial<SettlementTreatment> = {},
): SettlementTreatment {
  const doctorShare = (Number(revenue) / 2).toFixed(2);
  const payable = ((Number(doctorShare) * Math.min(collectedPercent, 100)) / 100).toFixed(2);

  return {
    id,
    doctorId: DOCTOR_ID,
    performedAt: "2026-10-08T10:00:00.000Z",
    patientId: "11111111-1111-4111-8111-111111111111",
    patientName: "ركان السيد",
    fileNumber: "00001",
    procedureName: "Scaling",
    price: revenue,
    discount: "0.00",
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
    ...overrides,
  };
}

const totals = (doctorShare: string, payable: string): SettlementTotals => ({
  revenue: "0.00",
  tax: "0.00",
  overhead: "0.00",
  materials: "0.00",
  net: "0.00",
  clinicShare: "0.00",
  doctorShare,
  payable,
  paid: "0.00",
  outstanding: payable,
});

describe("groupByCollection", () => {
  it("keeps a treatment the patient has paid in full apart from one still waiting on them", () => {
    const groups = groupByCollection([
      treatment("a", "200.00", 100),
      treatment("b", "600.00", 0),
      treatment("c", "150.00", 40),
    ]);

    expect(groups.collected.map((row) => row.id)).toEqual(["a"]);
    expect(groups.waiting.map((row) => row.id)).toEqual(["b", "c"]);
  });
});

describe("shareSplit", () => {
  it("splits the doctor's share into what is ready and what waits on patients", () => {
    expect(shareSplit(totals("1020.00", "225.00"))).toEqual({
      share: "1020.00",
      ready: "225.00",
      waiting: "795.00",
      readyPercent: 22,
    });
  });

  it("reports nothing ready when there is no share yet", () => {
    expect(shareSplit(totals("0.00", "0.00")).readyPercent).toBe(0);
  });
});

describe("sumMoney", () => {
  it("adds a column without floating-point drift", () => {
    const rows = [treatment("a", "0.20", 0), treatment("b", "0.40", 0)];

    expect(sumMoney(rows, (row) => row.doctorShare)).toBe("0.30");
  });
});
