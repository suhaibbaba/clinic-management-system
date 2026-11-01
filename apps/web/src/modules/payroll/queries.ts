import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type {
  CollectionTerm,
  CollectionTermsInput,
  CreatePayrollAdjustmentInput,
  CreateRemittanceInput,
  CreateSalaryPaymentInput,
  CreateSettlementPayoutInput,
  DoctorSettlement,
  OwnerDraw,
  PayPlan,
  PayPlanInput,
  PayRules,
  PayRulesInput,
  Payroll,
  SalaryTerm,
  SalaryTermsInput,
  SettlementQuery,
  SettlementTermsInput,
  ShareTerm,
  ShareTermsInput,
  UpdateTreatmentSettlementInput,
} from "@clinic/shared";
import { payrollApi } from "@web/modules/payroll/api";
import { PAYROLL_KEY } from "@web/shared/constants/query-keys";

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

export function usePayRules(enabled: boolean): UseQueryResult<PayRules> {
  return useQuery({
    queryKey: [PAYROLL_KEY, "pay-rules"],
    queryFn: () => payrollApi.payRules(),
    enabled,
  });
}

export function useShareTermHistory(userId: string | null): UseQueryResult<ShareTerm[]> {
  return useQuery({
    queryKey: [PAYROLL_KEY, "share-terms", userId],
    queryFn: () => payrollApi.shareTerms(userId ?? ""),
    enabled: userId !== null,
  });
}

export function useOwnerDraws(enabled: boolean): UseQueryResult<OwnerDraw[]> {
  return useQuery({
    queryKey: [PAYROLL_KEY, "owner-draws"],
    queryFn: () => payrollApi.ownerDraws(),
    enabled,
  });
}

export function usePlanHistory(userId: string | null): UseQueryResult<PayPlan[]> {
  return useQuery({
    queryKey: [PAYROLL_KEY, "plans", userId],
    queryFn: () => payrollApi.plans(userId ?? ""),
    enabled: userId !== null,
  });
}

export function useCollectionTerms(doctorId: string | null): UseQueryResult<CollectionTerm[]> {
  return useQuery({
    queryKey: [PAYROLL_KEY, "collection-terms", doctorId],
    queryFn: () => payrollApi.collectionTerms(doctorId ?? ""),
    enabled: doctorId !== null,
  });
}

export function useSettlement(
  doctorId: string | null,
  query: SettlementQuery,
  enabled: boolean,
): UseQueryResult<DoctorSettlement> {
  return useQuery({
    queryKey: [PAYROLL_KEY, "settlement", doctorId, query.from, query.to, query.status ?? null],
    queryFn: () => payrollApi.settlement(doctorId ?? "", query),
    enabled: enabled && doctorId !== null,
    placeholderData: (previous) => previous,
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

export const useSetPayRules = () =>
  usePayrollWrite((body: PayRulesInput) => payrollApi.setPayRules(body));

export const useSetPlan = () =>
  usePayrollWrite(({ userId, body }: { userId: string; body: PayPlanInput }) =>
    payrollApi.setPlan(userId, body),
  );

export const useSetClinicRate = () =>
  usePayrollWrite(({ doctorId, body }: { doctorId: string; body: SettlementTermsInput }) =>
    payrollApi.setClinicRate(doctorId, body),
  );

export const useSetCollector = () =>
  usePayrollWrite(({ doctorId, body }: { doctorId: string; body: CollectionTermsInput }) =>
    payrollApi.setCollector(doctorId, body),
  );

export const useRemit = (doctorId: string) =>
  usePayrollWrite((body: CreateRemittanceInput) => payrollApi.remit(doctorId, body));

export const useSetShareTerms = () =>
  usePayrollWrite(({ userId, body }: { userId: string; body: ShareTermsInput }) =>
    payrollApi.setShareTerms(userId, body),
  );

export const useAdjustPay = (month: string) =>
  usePayrollWrite((body: CreatePayrollAdjustmentInput) => payrollApi.adjust(month, body));

export const useReverseAdjustment = () =>
  usePayrollWrite(({ id, reason }: { id: string; reason: string }) =>
    payrollApi.reverseAdjustment(id, reason),
  );

export const usePaySalary = (month: string) =>
  usePayrollWrite((body: CreateSalaryPaymentInput) => payrollApi.pay(month, body));

export const useReversePayment = () =>
  usePayrollWrite(({ id, reason }: { id: string; reason: string }) =>
    payrollApi.reversePayment(id, reason),
  );

export const useCloseMonth = (month: string) => usePayrollWrite(() => payrollApi.close(month));

export const useReopenMonth = (month: string) =>
  usePayrollWrite((reason: string) => payrollApi.reopen(month, reason));

export const useSetTreatmentShare = () =>
  usePayrollWrite(
    ({ treatmentId, body }: { treatmentId: string; body: UpdateTreatmentSettlementInput }) =>
      payrollApi.setTreatmentShare(treatmentId, body),
  );

export const useRecordPayout = (doctorId: string) =>
  usePayrollWrite((body: CreateSettlementPayoutInput) => payrollApi.payout(doctorId, body));
