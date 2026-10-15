import type { CreateExpenseInput, Expense, ExpenseQuery, ExpensesPage } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const expensesApi = {
  list: (query: ExpenseQuery): Promise<ExpensesPage> => apiRequest("/expenses", { query }),

  create: (body: CreateExpenseInput): Promise<Expense> =>
    apiRequest("/expenses", { method: "POST", body }),

  reverse: (id: string, reason: string): Promise<Expense> =>
    apiRequest(`/expenses/${id}/reverse`, { method: "POST", body: { reason } }),
};
