import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type {
  CreatePayrollAdjustmentInput,
  CreateSalaryPaymentInput,
  Payroll,
  SalaryTerm,
  SalaryTermsInput,
} from "@clinic/shared";
import { payrollApi } from "@web/modules/payroll/api";

const PAYROLL_KEY = "payroll";

export function usePayroll(month: string, enabled: boolean): UseQueryResult<Payroll> {
  return useQuery({
    queryKey: [PAYROLL_KEY, "month", month],
    queryFn: () => payrollApi.month(month),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useSalaryHistory(userId: string | null): UseQueryResult<SalaryTerm[]> {
  return useQuery({
    queryKey: [PAYROLL_KEY, "salaries", userId],
    queryFn: () => payrollApi.salaries(userId ?? ""),
    enabled: userId !== null,
  });
}

function usePayrollWrite<TInput, TResult>(write: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: write,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PAYROLL_KEY] }),
  });
}

export const useSetSalary = () =>
  usePayrollWrite(({ userId, body }: { userId: string; body: SalaryTermsInput }) =>
    payrollApi.setSalary(userId, body),
  );

export const useAdjustPay = (month: string) =>
  usePayrollWrite((body: CreatePayrollAdjustmentInput) => payrollApi.adjust(month, body));

export const useReverseAdjustment = () =>
  usePayrollWrite(({ id, reason }: { id: string; reason: string }) =>
    payrollApi.reverseAdjustment(id, reason),
  );

export const usePaySalary = (month: string) =>
  usePayrollWrite((body: CreateSalaryPaymentInput) => payrollApi.pay(month, body));

export const useReverseSalaryPayment = () =>
  usePayrollWrite(({ id, reason }: { id: string; reason: string }) =>
    payrollApi.reversePayment(id, reason),
  );

export const useCloseMonth = (month: string) => usePayrollWrite(() => payrollApi.close(month));
