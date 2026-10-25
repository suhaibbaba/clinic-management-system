import type { PayrollLine, SettlementTotals } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { payBreakdown } from "@web/modules/payroll/lib/pay-breakdown";
import { payActions, payStatus, salaryPayLabel } from "@web/modules/payroll/lib/plans";
import { DOCTOR_ID } from "@test/helpers/fixtures";

const USER_ID = "77777777-7777-4777-8777-777777777777";

function line(overrides: Partial<PayrollLine> = {}): PayrollLine {
  return {
    userId: USER_ID,
    name: { ar: "سارة", en: "Sara" },
    role: "doctor",
    joinedOn: null,
    plan: "salary",
    planKinds: ["salary", "percentage", "salary_and_percentage"],
    employee: true,
    doctorId: DOCTOR_ID,
    shareBasis: "treatments",
    shareRate: 0,
    percentBase: "0.00",
    percentShare: "0.00",
    share: "0.00",
    sharePayable: "0.00",
    sharePaid: "0.00",
    base: "3000.00",
    extras: "0.00",
    cuts: "0.00",
    due: "3000.00",
    paid: "0.00",
    remaining: "3000.00",
    expected: "3000.00",
    received: "0.00",
    owed: "3000.00",
    adjustments: [],
    payments: [],
    ...overrides,
  };
}

const totals: SettlementTotals = {
  revenue: "1000.00",
  tax: "100.00",
  overhead: "50.00",
  materials: "50.00",
  net: "800.00",
  clinicShare: "400.00",
  doctorShare: "400.00",
  payable: "400.00",
  paid: "0.00",
  outstanding: "400.00",
};

const keys = (groups: ReturnType<typeof payBreakdown>) =>
  groups.map((group) => [group.key, group.rows.map((row) => row.key)]);

describe("payBreakdown", () => {
  it("shows a salaried person their salary and the totals only", () => {
    expect(keys(payBreakdown(line(), undefined))).toEqual([
      ["salary", ["base"]],
      ["total", ["expected", "received", "owed"]],
    ]);
  });

  it("adds a bonus and a deduction only when there is one", () => {
    const groups = payBreakdown(line({ extras: "200.00", cuts: "50.00" }), undefined);

    expect(groups[0]?.rows.map((row) => [row.key, row.sign])).toEqual([
      ["base", "plus"],
      ["extras", "plus"],
      ["cuts", "minus"],
    ]);
  });

  it("walks a percentage doctor from the revenue down to their share, without a salary", () => {
    const groups = payBreakdown(
      line({ plan: "percentage", base: "0.00", due: "0.00", sharePayable: "400.00" }),
      totals,
    );

    expect(keys(groups)).toEqual([
      ["share", ["revenue", "tax", "overhead", "materials", "net", "clinicShare", "share"]],
      ["total", ["expected", "received", "owed"]],
    ]);
  });

  it("does not repeat the total when the share alone already shows it", () => {
    const groups = payBreakdown(
      line({ plan: "percentage", base: "0.00", sharePayable: "400.00", expected: "400.00" }),
      totals,
    );

    expect(groups.at(-1)?.rows.map((row) => row.key)).toEqual(["received", "owed"]);
  });

  it("skips the net line when there is nothing to take off the revenue", () => {
    const groups = payBreakdown(line({ plan: "percentage" }), {
      ...totals,
      tax: "0.00",
      overhead: "0.00",
      materials: "0.00",
      net: "1000.00",
    });

    expect(groups[0]?.rows.map((row) => row.key)).toEqual(["revenue", "clinicShare", "share"]);
  });

  it("leaves out a tax, expense or material line that comes to nothing", () => {
    const groups = payBreakdown(line({ plan: "percentage" }), {
      ...totals,
      tax: "0.00",
      materials: "0.00",
    });

    expect(groups[0]?.rows.map((row) => row.key)).toEqual([
      "revenue",
      "overhead",
      "net",
      "clinicShare",
      "share",
    ]);
  });

  it("names what still waits on the patient when the share follows collection", () => {
    const groups = payBreakdown(line({ plan: "percentage", sharePayable: "300.00" }), {
      ...totals,
      payable: "300.00",
    });
    const waiting = groups[0]?.rows.find((row) => row.key === "waiting");

    expect(waiting).toMatchObject({ amount: "100.00", sign: "minus" });
  });
});

describe("a percentage of payments or of profit", () => {
  const receptionist = line({
    role: "receptionist",
    doctorId: null,
    plan: "percentage",
    base: "0.00",
    shareBasis: "collections",
    shareRate: 10,
    percentBase: "20000.00",
    percentShare: "2000.00",
    due: "2000.00",
  });

  it("shows what the percentage is taken from, then the share, without a salary", () => {
    const groups = payBreakdown(receptionist, undefined);

    expect(groups[0]?.rows).toEqual([
      expect.objectContaining({ key: "percentBase", label: "payroll.calc.bases.collections" }),
      expect.objectContaining({ key: "percentShare", amount: "2000.00", percent: 10 }),
    ]);
    expect(groups.map((group) => group.key)).toEqual(["share", "total"]);
  });

  it("pays the percentage through the salary payment and never as a treatment share", () => {
    expect(payActions(receptionist, false)).toEqual({
      paySalary: true,
      payShare: false,
      adjust: true,
    });
    expect(salaryPayLabel(receptionist)).toBe("payPercent");
  });

  it("gives a doctor on a share of profit no treatment payout", () => {
    expect(payActions(line({ plan: "percentage", shareBasis: "profit" }), false).payShare).toBe(
      false,
    );
  });
});

describe("payActions", () => {
  it("gives a salaried person salary pay and adjustments, never a share", () => {
    expect(payActions(line(), false)).toEqual({ paySalary: true, payShare: false, adjust: true });
  });

  it("gives a percentage doctor the share, and salary pay only for a bonus still owed", () => {
    const percentage = line({ plan: "percentage", remaining: "0.00" });

    expect(payActions(percentage, false)).toEqual({
      paySalary: false,
      payShare: true,
      adjust: true,
    });
    expect(payActions({ ...percentage, remaining: "150.00" }, false).paySalary).toBe(true);
  });

  it("gives a visiting doctor the share alone", () => {
    expect(
      payActions(line({ plan: "percentage", employee: false, remaining: "0.00" }), false),
    ).toEqual({ paySalary: false, payShare: true, adjust: false });
  });

  it("stops adjustments once the month is closed", () => {
    expect(payActions(line(), true).adjust).toBe(false);
  });
});

describe("payStatus", () => {
  it("reads nothing due, unpaid, partly paid and paid", () => {
    expect(payStatus(line({ expected: "0.00", owed: "0.00" }))).toBe("nothing");
    expect(payStatus(line())).toBe("unpaid");
    expect(payStatus(line({ received: "1000.00", owed: "2000.00" }))).toBe("partly");
    expect(payStatus(line({ received: "3000.00", owed: "0.00" }))).toBe("paid");
  });
});
