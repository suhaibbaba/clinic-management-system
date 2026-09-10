import type {
  ConfirmLabAttachmentInput,
  CreateLabInput,
  CreateLabOrderInput,
  CreateLabPaymentInput,
  CreateLabWorkTypeInput,
  Lab,
  LabBalance,
  LabOrderAttachment,
  LabOrderRow,
  LabPayment,
  LabStatement,
  LabSummary,
  LabWorkType,
  ListLabOrdersQuery,
  PresignAttachmentUploadResponse,
  PresignLabAttachmentInput,
  ListLabsQuery,
  PaginationQuery,
  Paginated,
  ReverseLabPaymentInput,
  StatementQuery,
  UpdateLabInput,
  UpdateLabOrderInput,
  UpdateLabWorkTypeInput,
} from '@clinic/shared';

import { apiDownload, apiRequest } from '@web/lib/api-client';

const query = (params: Record<string, string | number | boolean | undefined>): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  return search.size > 0 ? `?${search.toString()}` : '';
};

export const labsApi = {
  list: (params: Partial<ListLabsQuery> = {}) =>
    apiRequest<Paginated<LabSummary>>(`/labs${query(params)}`),

  findOne: (id: string) => apiRequest<LabSummary>(`/labs/${id}`),

  create: (body: CreateLabInput) => apiRequest<Lab>('/labs', { method: 'POST', body }),

  update: (id: string, body: UpdateLabInput) =>
    apiRequest<Lab>(`/labs/${id}`, { method: 'PATCH', body }),

  workTypes: (labId: string, includeInactive = false) =>
    apiRequest<LabWorkType[]>(`/labs/${labId}/work-types${query({ includeInactive })}`),

  createWorkType: (labId: string, body: CreateLabWorkTypeInput) =>
    apiRequest<LabWorkType>(`/labs/${labId}/work-types`, { method: 'POST', body }),

  updateWorkType: (id: string, body: UpdateLabWorkTypeInput) =>
    apiRequest<LabWorkType>(`/labs/work-types/${id}`, { method: 'PATCH', body }),

  balance: (labId: string) => apiRequest<LabBalance>(`/labs/${labId}/balance`),

  statement: (labId: string, params: StatementQuery) =>
    apiRequest<LabStatement>(`/labs/${labId}/statement${query({ ...params })}`),

  statementPdf: (labId: string, params: StatementQuery): Promise<Blob> =>
    apiDownload(`/labs/${labId}/statement.pdf`, { ...params }),

  payments: (labId: string, params: Partial<PaginationQuery> = {}) =>
    apiRequest<Paginated<LabPayment>>(`/labs/${labId}/payments${query(params)}`),

  pay: (body: CreateLabPaymentInput) =>
    apiRequest<LabPayment>('/lab-payments', { method: 'POST', body }),

  reversePayment: (id: string, body: ReverseLabPaymentInput) =>
    apiRequest<LabPayment>(`/lab-payments/${id}/reverse`, { method: 'PATCH', body }),
};

export const labOrdersApi = {
  list: (params: Partial<ListLabOrdersQuery> = {}) =>
    apiRequest<Paginated<LabOrderRow>>(`/lab-orders${query(params)}`),

  overdue: () => apiRequest<LabOrderRow[]>('/lab-orders/overdue'),

  findOne: (id: string) => apiRequest<LabOrderRow>(`/lab-orders/${id}`),

  create: (body: CreateLabOrderInput) =>
    apiRequest<LabOrderRow>('/lab-orders', { method: 'POST', body }),

  update: (id: string, body: UpdateLabOrderInput) =>
    apiRequest<LabOrderRow>(`/lab-orders/${id}`, { method: 'PATCH', body }),

  send: (id: string) => apiRequest<LabOrderRow>(`/lab-orders/${id}/send`, { method: 'PATCH' }),
  ready: (id: string) => apiRequest<LabOrderRow>(`/lab-orders/${id}/ready`, { method: 'PATCH' }),
  receive: (id: string) =>
    apiRequest<LabOrderRow>(`/lab-orders/${id}/receive`, { method: 'PATCH' }),
  fit: (id: string) => apiRequest<LabOrderRow>(`/lab-orders/${id}/fit`, { method: 'PATCH' }),
  returnToLab: (id: string, reason: string) =>
    apiRequest<LabOrderRow>(`/lab-orders/${id}/return`, { method: 'PATCH', body: { reason } }),
  cancel: (id: string) => apiRequest<LabOrderRow>(`/lab-orders/${id}/cancel`, { method: 'PATCH' }),

  attachments: (id: string) => apiRequest<LabOrderAttachment[]>(`/lab-orders/${id}/attachments`),

  // Presign, PUT, confirm — the API re-reads the object's real size and type from the bucket, so
  // nothing sent from here is trusted.
  presignAttachment: (id: string, body: PresignLabAttachmentInput) =>
    apiRequest<PresignAttachmentUploadResponse>(`/lab-orders/${id}/attachments/presign`, {
      method: 'POST',
      body,
    }),

  confirmAttachment: (id: string, body: ConfirmLabAttachmentInput) =>
    apiRequest<LabOrderAttachment>(`/lab-orders/${id}/attachments`, { method: 'POST', body }),

  deleteAttachment: (id: string, attachmentId: string) =>
    apiRequest<void>(`/lab-orders/${id}/attachments/${attachmentId}`, { method: 'DELETE' }),

  sheetPdf: (id: string): Promise<Blob> => apiDownload(`/lab-orders/${id}/print`),
};
