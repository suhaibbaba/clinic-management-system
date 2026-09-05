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

import { apiDownload, apiRequest } from '@web/lib/api-client';

/**
 * The money endpoints.
 *
 * Nothing here updates an amount, because nothing server-side would accept it:
 * a payment is created or reversed, never edited (CLAUDE.md ledger rules).
 */
export const billingApi = {
  balance: (patientId: string): Promise<PatientBalance> =>
    apiRequest(`/patients/${patientId}/balance`),

  statement: (patientId: string, query: StatementQuery): Promise<Statement> =>
    apiRequest(`/patients/${patientId}/statement`, { query: { ...query } }),

  statementPdf: (patientId: string, query: StatementQuery): Promise<Blob> =>
    apiDownload(`/patients/${patientId}/statement.pdf`, { ...query }),

  payments: (query: Partial<ListPaymentsQuery>): Promise<Paginated<Payment>> =>
    apiRequest('/payments', { query: { ...query } }),

  createPayment: (body: CreatePaymentInput): Promise<Payment> =>
    apiRequest('/payments', { method: 'POST', body }),

  reversePayment: (id: string, body: ReversePaymentInput): Promise<Payment> =>
    apiRequest(`/payments/${id}/reverse`, { method: 'POST', body }),

  receiptPdf: (paymentId: string): Promise<Blob> => apiDownload(`/payments/${paymentId}/receipt`),

  overdue: (query: Partial<ListOverdueQuery>): Promise<Paginated<OverduePatient>> =>
    apiRequest('/billing/overdue', { query: { ...query } }),
};
