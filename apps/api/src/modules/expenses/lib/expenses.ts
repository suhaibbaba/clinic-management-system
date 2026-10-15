import { type Expense } from "@clinic/shared";
import { expenses } from "@api/database/schema";

export type ExpenseRow = typeof expenses.$inferSelect;

export function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    spentOn: row.spentOn,
    category: row.category,
    amount: row.amount,
    method: row.method,
    note: row.note,
    reversesId: row.reversesId,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const monthOfDate = (date: string): string => date.slice(0, 7);
