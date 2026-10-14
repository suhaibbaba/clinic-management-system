import { PAY_PLAN_KIND, type PayPlanKind, type PayrollLine } from "@clinic/shared";

export const includesSalary = (kind: PayPlanKind): boolean => kind !== PAY_PLAN_KIND.PERCENTAGE;

export const includesShare = (kind: PayPlanKind): boolean => kind !== PAY_PLAN_KIND.SALARY;

export interface PayActions {
  readonly paySalary: boolean;
  readonly payShare: boolean;
  readonly adjust: boolean;
}

export function payActions(line: PayrollLine, closed: boolean): PayActions {
  return {
    paySalary: line.employee && (includesSalary(line.plan) || Number(line.remaining) > 0),
    payShare: includesShare(line.plan) && line.doctorId !== null,
    adjust: line.employee && !closed,
  };
}

export type PayStatus = "nothing" | "paid" | "partly" | "unpaid";

export function payStatus(line: PayrollLine): PayStatus {
  if (Number(line.expected) <= 0) {
    return "nothing";
  }
  if (Number(line.owed) <= 0) {
    return "paid";
  }

  return Number(line.received) > 0 ? "partly" : "unpaid";
}
