import { z } from "zod";
import { PAYROLL_ADJUSTMENT_KINDS, STAFF_PAYMENT_KINDS, USER_ROLES } from "@shared/enums";
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

export const payrollLineSchema = z.object({
  userId: uuidSchema,
  name: personNameSchema,
  role: z.enum(USER_ROLES),
  joinedOn: calendarDateSchema.nullable(),
  base: signedMoneySchema,
  extras: signedMoneySchema,
  cuts: signedMoneySchema,
  due: signedMoneySchema,
  paid: signedMoneySchema,
  remaining: signedMoneySchema,
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
});
export type PayrollTotals = z.infer<typeof payrollTotalsSchema>;

export const payrollSchema = z.object({
  month: payrollMonthSchema,
  closedAt: z.iso.datetime().nullable(),
  lines: z.array(payrollLineSchema),
  totals: payrollTotalsSchema,
  visitingShares: signedMoneySchema,
  staffCost: signedMoneySchema,
});
export type Payroll = z.infer<typeof payrollSchema>;
