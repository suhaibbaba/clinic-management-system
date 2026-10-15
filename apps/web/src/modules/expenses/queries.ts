import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { CreateExpenseInput, ExpenseQuery, ExpensesPage } from "@clinic/shared";
import { expensesApi } from "@web/modules/expenses/api";
import { PAYROLL_KEY } from "@web/shared/constants/query-keys";

const EXPENSES_KEY = "expenses";

export function useExpenses(query: ExpenseQuery): UseQueryResult<ExpensesPage> {
  return useQuery({
    queryKey: [EXPENSES_KEY, query],
    queryFn: () => expensesApi.list(query),
    placeholderData: (previous) => previous,
  });
}

function useExpenseWrite<TInput>(write: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: write,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY] }),
        queryClient.invalidateQueries({ queryKey: [PAYROLL_KEY] }),
      ]);
    },
  });
}

export const useCreateExpense = () =>
  useExpenseWrite((body: CreateExpenseInput) => expensesApi.create(body));

export const useReverseExpense = () =>
  useExpenseWrite(({ id, reason }: { id: string; reason: string }) =>
    expensesApi.reverse(id, reason),
  );
