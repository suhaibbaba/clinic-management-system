import {
  LAB_COST_BEARER,
  PAYMENT_COLLECTOR,
  PAY_BASIS,
  PAY_PLAN_KIND,
  PAY_PLAN_KINDS,
  STAFF_SHARE_BASIS,
  USER_ROLE,
  type CollectionTerm,
  type PayPlan,
  type PayPlanKind,
  type PaymentCollector,
  type PayRule,
  type PayrollMonth,
  type ShareTerm,
  type StaffShareBasis,
  type UserRole,
} from "@clinic/shared";
import { collectionTerms, payPlans, payRules, shareTerms } from "@api/database/schema";
import { monthOf } from "@api/modules/payroll/lib/payroll";

export type PayRuleRow = typeof payRules.$inferSelect;

export type PayPlanRow = typeof payPlans.$inferSelect;

export type ShareTermRow = typeof shareTerms.$inferSelect;

export type CollectionTermRow = typeof collectionTerms.$inferSelect;

export function toPayRule(row: PayRuleRow): PayRule {
  return {
    id: row.id,
    clinicSharePercent: Number(row.clinicSharePercent),
    taxPercent: Number(row.taxPercent),
    overheadPercent: Number(row.overheadPercent),
    basis: row.basis,
    labCostBearer: row.labCostBearer,
    effectiveMonth: monthOf(row.effectiveMonth),
    createdAt: row.createdAt.toISOString(),
  };
}

export function defaultPayRule(month: PayrollMonth): PayRule {
  return {
    id: null,
    clinicSharePercent: 0,
    taxPercent: 0,
    overheadPercent: 0,
    basis: PAY_BASIS.DONE,
    labCostBearer: LAB_COST_BEARER.SHARED,
    effectiveMonth: month,
    createdAt: null,
  };
}

export function toPayPlan(row: PayPlanRow): PayPlan {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    effectiveMonth: monthOf(row.effectiveMonth),
    createdAt: row.createdAt.toISOString(),
  };
}

export function defaultPlan(role: UserRole): PayPlanKind {
  return role === USER_ROLE.VISITING_DOCTOR ? PAY_PLAN_KIND.PERCENTAGE : PAY_PLAN_KIND.SALARY;
}

export function planKindsFor(role: UserRole): PayPlanKind[] {
  return role === USER_ROLE.VISITING_DOCTOR ? [PAY_PLAN_KIND.PERCENTAGE] : [...PAY_PLAN_KINDS];
}

export interface ShareTermsAt {
  readonly basis: StaffShareBasis;
  readonly percent: number;
}

export function defaultShareTerms(isDoctor: boolean): ShareTermsAt {
  return {
    basis: isDoctor ? STAFF_SHARE_BASIS.TREATMENTS : STAFF_SHARE_BASIS.COLLECTIONS,
    percent: 0,
  };
}

export function toShareTerm(row: ShareTermRow): ShareTerm {
  return {
    id: row.id,
    userId: row.userId,
    basis: row.basis,
    percent: Number(row.percent),
    effectiveMonth: monthOf(row.effectiveMonth),
    createdAt: row.createdAt.toISOString(),
  };
}

export const isEmployee = (role: UserRole): boolean => role !== USER_ROLE.VISITING_DOCTOR;

export const includesSalary = (kind: PayPlanKind): boolean => kind !== PAY_PLAN_KIND.PERCENTAGE;

export const includesShare = (kind: PayPlanKind): boolean => kind !== PAY_PLAN_KIND.SALARY;

export function toCollectionTerm(row: CollectionTermRow): CollectionTerm {
  return {
    id: row.id,
    doctorId: row.doctorId,
    collector: row.collector,
    effectiveMonth: monthOf(row.effectiveMonth),
    createdAt: row.createdAt.toISOString(),
  };
}

export const DEFAULT_COLLECTOR: PaymentCollector = PAYMENT_COLLECTOR.CLINIC;

export const doctorCollects = (collector: PaymentCollector): boolean =>
  collector === PAYMENT_COLLECTOR.DOCTOR;
