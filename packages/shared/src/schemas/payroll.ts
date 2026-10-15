import { z } from "zod";
import {
  LAB_COST_BEARERS,
  PAY_BASES,
  PAY_PLAN_KINDS,
  PAYROLL_ADJUSTMENT_KINDS,
  STAFF_PAYMENT_KINDS,
  STAFF_SHARE_BASES,
  USER_ROLES,
} from "@shared/enums";
import { VALIDATION_CODE, calendarDateSchema, uuidSchema } from "@shared/schemas/common";
import { lookupCodeSchema } from "@shared/schemas/lookups";
import { signedMoneySchema, wholeMoneySchema } from "@shared/schemas/money";
import { personNameSchema } from "@shared/schemas/person-name";

export const payrollMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected a YYYY-MM month")
  .refine((value) => {
    const year = Number(value.slice(0, 4));

    return year >= 1900 && year <= 2100;
  }, VALIDATION_CODE.YEAR_OUT_OF_RANGE);
export type PayrollMonth = z.infer<typeof payrollMonthSchema>;

export const payrollMonthParamSchema = z.object({ month: payrollMonthSchema });
export type PayrollMonthParam = z.infer<typeof payrollMonthParamSchema>;

const positiveAmount = wholeMoneySchema.refine(
  (value) => Number(value) > 0,
  "An amount must be greater than zero",
);

export const staffPaymentSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  userId: uuidSchema,
  kind: z.enum(STAFF_PAYMENT_KINDS),
  month: payrollMonthSchema.nullable(),
  amount: signedMoneySchema,
  method: lookupCodeSchema,
  note: z.string().nullable(),
  reversesId: uuidSchema.nullable(),
  reversedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type StaffPayment = z.infer<typeof staffPaymentSchema>;

export const createStaffPaymentSchema = z.object({
  amount: positiveAmount,
  method: lookupCodeSchema,
  note: z.string().trim().max(500).nullish(),
});
export type CreateStaffPaymentInput = z.infer<typeof createStaffPaymentSchema>;

export const createSalaryPaymentSchema = createStaffPaymentSchema.extend({ userId: uuidSchema });
export type CreateSalaryPaymentInput = z.infer<typeof createSalaryPaymentSchema>;

export const reverseEntrySchema = z.object({ reason: z.string().trim().min(3).max(500) });
export type ReverseEntryInput = z.infer<typeof reverseEntrySchema>;

export const salaryTermsInputSchema = z.object({
  monthlyAmount: wholeMoneySchema,
  effectiveMonth: payrollMonthSchema,
});
export type SalaryTermsInput = z.infer<typeof salaryTermsInputSchema>;

export const salaryTermSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  monthlyAmount: signedMoneySchema,
  effectiveMonth: payrollMonthSchema,
  createdAt: z.iso.datetime(),
});
export type SalaryTerm = z.infer<typeof salaryTermSchema>;

export const createPayrollAdjustmentSchema = z.object({
  userId: uuidSchema,
  kind: z.enum(PAYROLL_ADJUSTMENT_KINDS),
  amount: positiveAmount,
  reason: z.string().trim().min(3).max(500),
});
export type CreatePayrollAdjustmentInput = z.infer<typeof createPayrollAdjustmentSchema>;

export const payrollAdjustmentSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  month: payrollMonthSchema,
  kind: z.enum(PAYROLL_ADJUSTMENT_KINDS),
  amount: signedMoneySchema,
  reason: z.string(),
  reversesId: uuidSchema.nullable(),
  reversedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type PayrollAdjustment = z.infer<typeof payrollAdjustmentSchema>;

export const ratePercentSchema = z.number().min(0).max(100);

export const payRulesInputSchema = z.object({
  clinicSharePercent: ratePercentSchema,
  taxPercent: ratePercentSchema,
  overheadPercent: ratePercentSchema,
  basis: z.enum(PAY_BASES),
  labCostBearer: z.enum(LAB_COST_BEARERS),
  effectiveMonth: payrollMonthSchema,
});
export type PayRulesInput = z.infer<typeof payRulesInputSchema>;

export const payRuleSchema = payRulesInputSchema.extend({
  id: uuidSchema.nullable(),
  createdAt: z.iso.datetime().nullable(),
});
export type PayRule = z.infer<typeof payRuleSchema>;

export const payRulesSchema = z.object({
  current: payRuleSchema,
  history: z.array(payRuleSchema),
});
export type PayRules = z.infer<typeof payRulesSchema>;

export const payPlanInputSchema = z.object({
  kind: z.enum(PAY_PLAN_KINDS),
  effectiveMonth: payrollMonthSchema,
});
export type PayPlanInput = z.infer<typeof payPlanInputSchema>;

export const payPlanSchema = payPlanInputSchema.extend({
  id: uuidSchema,
  userId: uuidSchema,
  createdAt: z.iso.datetime(),
});
export type PayPlan = z.infer<typeof payPlanSchema>;

export const shareTermsInputSchema = z.object({
  basis: z.enum(STAFF_SHARE_BASES),
  percent: ratePercentSchema,
  effectiveMonth: payrollMonthSchema,
});
export type ShareTermsInput = z.infer<typeof shareTermsInputSchema>;

export const shareTermSchema = shareTermsInputSchema.extend({
  id: uuidSchema,
  userId: uuidSchema,
  createdAt: z.iso.datetime(),
});
export type ShareTerm = z.infer<typeof shareTermSchema>;

export const payrollLineSchema = z.object({
  userId: uuidSchema,
  name: personNameSchema,
  role: z.enum(USER_ROLES),
  joinedOn: calendarDateSchema.nullable(),
  plan: z.enum(PAY_PLAN_KINDS),
  planKinds: z.array(z.enum(PAY_PLAN_KINDS)),
  employee: z.boolean(),
  doctorId: uuidSchema.nullable(),
  shareBasis: z.enum(STAFF_SHARE_BASES),
  shareRate: z.number(),
  percentBase: signedMoneySchema,
  percentShare: signedMoneySchema,
  share: signedMoneySchema,
  sharePayable: signedMoneySchema,
  sharePaid: signedMoneySchema,
  base: signedMoneySchema,
  extras: signedMoneySchema,
  cuts: signedMoneySchema,
  due: signedMoneySchema,
  paid: signedMoneySchema,
  remaining: signedMoneySchema,
  expected: signedMoneySchema,
  received: signedMoneySchema,
  owed: signedMoneySchema,
  adjustments: z.array(payrollAdjustmentSchema),
  payments: z.array(staffPaymentSchema),
});
export type PayrollLine = z.infer<typeof payrollLineSchema>;

export const payrollTotalsSchema = z.object({
  base: signedMoneySchema,
  extras: signedMoneySchema,
  cuts: signedMoneySchema,
  due: signedMoneySchema,
  paid: signedMoneySchema,
  remaining: signedMoneySchema,
  expected: signedMoneySchema,
  received: signedMoneySchema,
  owed: signedMoneySchema,
});
export type PayrollTotals = z.infer<typeof payrollTotalsSchema>;

export const monthProfitSchema = z.object({
  collections: signedMoneySchema,
  staffPay: signedMoneySchema,
  doctorShares: signedMoneySchema,
  labs: signedMoneySchema,
  stock: signedMoneySchema,
  expenses: signedMoneySchema,
  beforeShares: signedMoneySchema,
  profitShares: signedMoneySchema,
  ownerProfit: signedMoneySchema,
});
export type MonthProfit = z.infer<typeof monthProfitSchema>;

export const ownerDrawSchema = z.object({
  id: uuidSchema,
  month: payrollMonthSchema,
  amount: signedMoneySchema,
  profit: monthProfitSchema,
  createdAt: z.iso.datetime(),
});
export type OwnerDraw = z.infer<typeof ownerDrawSchema>;

export const payrollSchema = z.object({
  month: payrollMonthSchema,
  closedAt: z.iso.datetime().nullable(),
  profit: monthProfitSchema,
  draw: ownerDrawSchema.nullable(),
  lines: z.array(payrollLineSchema),
  totals: payrollTotalsSchema,
  doctorShares: signedMoneySchema,
  staffCost: signedMoneySchema,
});
export type Payroll = z.infer<typeof payrollSchema>;
