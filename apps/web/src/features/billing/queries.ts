import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreatePaymentInput,
  PatientBalance,
  ReversePaymentInput,
  Statement,
  StatementQuery,
} from '@clinic/shared';

import { billingApi } from '@web/features/billing/api';
import { DASHBOARD_KEY } from '@web/features/dashboard/queries';
import { PATIENT_KEY, PATIENTS_KEY } from '@web/features/patients/queries';

export const BALANCE_KEY = 'patient-balance';
export const STATEMENT_KEY = 'patient-statement';
export const PAYMENTS_KEY = 'payments';

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

// Everything a payment touches is derived, so it invalidates the balance, the statement, the header
// — and the patients list and dashboard, which can be filtered or totalled by what is owed.
function useLedgerInvalidation(): () => Promise<void> {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all(
      [BALANCE_KEY, STATEMENT_KEY, PAYMENTS_KEY, PATIENT_KEY, PATIENTS_KEY, DASHBOARD_KEY].map(
        (key) => queryClient.invalidateQueries({ queryKey: [key] }),
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
