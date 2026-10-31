import {
  PAYMENT_COLLECTOR,
  PAY_PLAN_KIND,
  STAFF_SHARE_BASIS,
  type PayPlanKind,
  type PayrollLine,
} from "@clinic/shared";

export const includesSalary = (kind: PayPlanKind): boolean => kind !== PAY_PLAN_KIND.PERCENTAGE;

export const includesShare = (kind: PayPlanKind): boolean => kind !== PAY_PLAN_KIND.SALARY;

export const sharesTreatments = (line: PayrollLine): boolean =>
  includesShare(line.plan) &&
  line.doctorId !== null &&
  line.shareBasis === STAFF_SHARE_BASIS.TREATMENTS;

export const sharesPercent = (line: PayrollLine): boolean =>
  includesShare(line.plan) && line.shareBasis !== STAFF_SHARE_BASIS.TREATMENTS;

export type SalaryPayLabel = "paySalary" | "payPercent" | "payBonus";

export function salaryPayLabel(line: PayrollLine): SalaryPayLabel {
  if (includesSalary(line.plan)) {
    return "paySalary";
  }

  return sharesPercent(line) ? "payPercent" : "payBonus";
}

export interface PayActions {
  readonly paySalary: boolean;
  readonly payShare: boolean;
  readonly receive: boolean;
  readonly adjust: boolean;
}

export const collectsPayments = (line: PayrollLine): boolean =>
  line.collector === PAYMENT_COLLECTOR.DOCTOR;

export function payActions(line: PayrollLine, closed: boolean): PayActions {
  return {
    paySalary:
      line.employee &&
      (includesSalary(line.plan) || sharesPercent(line) || Number(line.remaining) > 0),
    payShare: sharesTreatments(line) && !collectsPayments(line),
    receive: collectsPayments(line),
    adjust: line.employee && !closed,
  };
}

export type PayStatus = "nothing" | "paid" | "partly" | "unpaid" | "owesClinic";

export function payStatus(line: PayrollLine): PayStatus {
  if (Number(line.owed) < 0 && collectsPayments(line)) {
    return "owesClinic";
  }
  if (Number(line.expected) <= 0) {
    return "nothing";
  }
  if (Number(line.owed) <= 0) {
    return "paid";
  }

  return Number(line.received) > 0 ? "partly" : "unpaid";
}
