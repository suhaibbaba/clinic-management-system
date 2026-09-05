import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreatePaymentInput,
  ListOverdueQuery,
  ListPaymentsQuery,
  OverduePatient,
  Paginated,
  PatientBalance,
  Payment,
  ReversePaymentInput,
  Statement,
  StatementQuery,
} from '@clinic/shared';

import { billingApi } from '@web/features/billing/api';
import { PATIENT_KEY } from '@web/features/patients/queries';

export const BALANCE_KEY = 'patient-balance';
export const STATEMENT_KEY = 'patient-statement';
export const PAYMENTS_KEY = 'payments';
export const OVERDUE_KEY = 'overdue';

export function usePatientBalance(
  patientId: string,
  enabled = true,
): UseQueryResult<PatientBalance> {
  return useQuery({
    queryKey: [BALANCE_KEY, patientId],
    queryFn: () => billingApi.balance(patientId),
    enabled: enabled && patientId !== '',
  });
}

export function useStatement(
  patientId: string,
  query: StatementQuery,
  enabled = true,
): UseQueryResult<Statement> {
  return useQuery({
    queryKey: [STATEMENT_KEY, patientId, query],
    queryFn: () => billingApi.statement(patientId, query),
    enabled: enabled && patientId !== '',
    placeholderData: (previous) => previous,
  });
}

export function usePayments(query: Partial<ListPaymentsQuery>): UseQueryResult<Paginated<Payment>> {
  return useQuery({
    queryKey: [PAYMENTS_KEY, query],
    queryFn: () => billingApi.payments(query),
    placeholderData: (previous) => previous,
  });
}

export function useOverduePatients(
  query: Partial<ListOverdueQuery>,
): UseQueryResult<Paginated<OverduePatient>> {
  return useQuery({
    queryKey: [OVERDUE_KEY, query],
    queryFn: () => billingApi.overdue(query),
    placeholderData: (previous) => previous,
  });
}

/**
 * Everything a payment touches is derived from the ledger, so recording one
 * invalidates the balance, the statement and the patient header together —
 * there is no cached total to patch by hand.
 */
function useLedgerInvalidation(): () => Promise<void> {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all(
      [BALANCE_KEY, STATEMENT_KEY, PAYMENTS_KEY, OVERDUE_KEY, PATIENT_KEY].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
}

export function useCreatePayment() {
  const invalidate = useLedgerInvalidation();

  return useMutation({
    mutationFn: (body: CreatePaymentInput) => billingApi.createPayment(body),
    onSuccess: invalidate,
  });
}

export function useReversePayment() {
  const invalidate = useLedgerInvalidation();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReversePaymentInput }) =>
      billingApi.reversePayment(id, body),
    onSuccess: invalidate,
  });
}
