import { z } from "zod";
import {
  calendarDateSchema,
  paginationQuerySchema,
  pastDateSchema,
  uuidSchema,
} from "@shared/schemas/common";
import { lookupCodeSchema } from "@shared/schemas/lookups";
import { signedMoneySchema, wholeMoneySchema } from "@shared/schemas/money";
import { payrollMonthSchema } from "@shared/schemas/payroll";

export const createExpenseSchema = z.object({
  spentOn: pastDateSchema,
  category: lookupCodeSchema,
  amount: wholeMoneySchema.refine(
    (value) => Number(value) > 0,
    "An amount must be greater than zero",
  ),
  method: lookupCodeSchema,
  note: z.string().trim().max(500).nullish(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const expenseSchema = z.object({
  id: uuidSchema,
  spentOn: calendarDateSchema,
  category: lookupCodeSchema,
  amount: signedMoneySchema,
  method: lookupCodeSchema,
  note: z.string().nullable(),
  reversesId: uuidSchema.nullable(),
  reversedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Expense = z.infer<typeof expenseSchema>;

export const expenseQuerySchema = paginationQuerySchema.extend({
  month: payrollMonthSchema,
  category: lookupCodeSchema.optional(),
});
export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;

export const expensesPageSchema = z.object({
  items: z.array(expenseSchema),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  monthTotal: signedMoneySchema,
});
export type ExpensesPage = z.infer<typeof expensesPageSchema>;
