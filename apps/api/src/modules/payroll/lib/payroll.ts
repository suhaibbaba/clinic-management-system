import {
  type PayrollAdjustment,
  type PayrollMonth,
  type SalaryTerm,
  type StaffPayment,
} from "@clinic/shared";
import { payrollAdjustments, salaryTerms, staffPayments } from "@api/database/schema";

export type StaffPaymentRow = typeof staffPayments.$inferSelect;

export type AdjustmentRow = typeof payrollAdjustments.$inferSelect;

export type SalaryTermRow = typeof salaryTerms.$inferSelect;

export const monthStart = (month: PayrollMonth): string => `${month}-01`;

export const monthOf = (date: string): PayrollMonth => date.slice(0, 7);

export function nextMonthStart(month: PayrollMonth): string {
  const [year = 0, index = 1] = month.split("-").map(Number);
  const next = index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, "0")}`;

  return `${next}-01`;
}

export function monthEnd(month: PayrollMonth): string {
  const next = new Date(`${nextMonthStart(month)}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() - 1);

  return next.toISOString().slice(0, 10);
}

export function toStaffPayment(row: StaffPaymentRow): StaffPayment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    userId: row.userId,
    kind: row.kind,
    month: row.month === null ? null : monthOf(row.month),
    amount: row.amount,
    method: row.method,
    note: row.note,
    reversesId: row.reversesId,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdjustment(row: AdjustmentRow): PayrollAdjustment {
  return {
    id: row.id,
    userId: row.userId,
    month: monthOf(row.month),
    kind: row.kind,
    amount: row.amount,
    reason: row.reason,
    reversesId: row.reversesId,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSalaryTerm(row: SalaryTermRow): SalaryTerm {
  return {
    id: row.id,
    userId: row.userId,
    monthlyAmount: row.monthlyAmount,
    effectiveMonth: monthOf(row.effectiveMonth),
    createdAt: row.createdAt.toISOString(),
  };
}
