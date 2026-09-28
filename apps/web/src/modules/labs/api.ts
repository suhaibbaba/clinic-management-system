import { toQueryString } from "@web/shared/lib/query-string";
import type {
  CancelLabOrderInput,
  ReturnLabOrderInput,
  LabOrderStageCounts,
  LabOrderStageCountsQuery,
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
} from "@clinic/shared";
import { apiDownload, apiRequest } from "@web/shared/lib/api-client";

export const labsApi = {
  list: (params: Partial<ListLabsQuery> = {}) =>
    apiRequest<Paginated<LabSummary>>(`/labs${toQueryString(params)}`),

  findOne: (id: string) => apiRequest<LabSummary>(`/labs/${id}`),

  create: (body: CreateLabInput) => apiRequest<Lab>("/labs", { method: "POST", body }),

  update: (id: string, body: UpdateLabInput) =>
    apiRequest<Lab>(`/labs/${id}`, { method: "PATCH", body }),

  workTypes: (labId: string, includeInactive = false) =>
    apiRequest<LabWorkType[]>(`/labs/${labId}/work-types${toQueryString({ includeInactive })}`),

  createWorkType: (labId: string, body: CreateLabWorkTypeInput) =>
    apiRequest<LabWorkType>(`/labs/${labId}/work-types`, { method: "POST", body }),

  updateWorkType: (id: string, body: UpdateLabWorkTypeInput) =>
    apiRequest<LabWorkType>(`/labs/work-types/${id}`, { method: "PATCH", body }),

  balance: (labId: string) => apiRequest<LabBalance>(`/labs/${labId}/balance`),

  statement: (labId: string, params: StatementQuery) =>
    apiRequest<LabStatement>(`/labs/${labId}/statement${toQueryString({ ...params })}`),

  statementPdf: (labId: string, params: StatementQuery): Promise<Blob> =>
    apiDownload(`/labs/${labId}/statement.pdf`, { ...params }),

  payments: (labId: string, params: Partial<PaginationQuery> = {}) =>
    apiRequest<Paginated<LabPayment>>(`/labs/${labId}/payments${toQueryString(params)}`),

  pay: (body: CreateLabPaymentInput) =>
    apiRequest<LabPayment>("/lab-payments", { method: "POST", body }),

  reversePayment: (id: string, body: ReverseLabPaymentInput) =>
    apiRequest<LabPayment>(`/lab-payments/${id}/reverse`, { method: "PATCH", body }),
};

export const labOrdersApi = {
  list: (params: Partial<ListLabOrdersQuery> = {}) =>
    apiRequest<Paginated<LabOrderRow>>(`/lab-orders${toQueryString(params)}`),

  overdue: () => apiRequest<LabOrderRow[]>("/lab-orders/overdue"),

  stages: (params: Partial<LabOrderStageCountsQuery> = {}) =>
    apiRequest<LabOrderStageCounts>(`/lab-orders/stages${toQueryString(params)}`),

  findOne: (id: string) => apiRequest<LabOrderRow>(`/lab-orders/${id}`),

  create: (body: CreateLabOrderInput) =>
    apiRequest<LabOrderRow>("/lab-orders", { method: "POST", body }),

  update: (id: string, body: UpdateLabOrderInput) =>
    apiRequest<LabOrderRow>(`/lab-orders/${id}`, { method: "PATCH", body }),

  send: (id: string) => apiRequest<LabOrderRow>(`/lab-orders/${id}/send`, { method: "PATCH" }),
  ready: (id: string) => apiRequest<LabOrderRow>(`/lab-orders/${id}/ready`, { method: "PATCH" }),
  receive: (id: string) =>
    apiRequest<LabOrderRow>(`/lab-orders/${id}/receive`, { method: "PATCH" }),
  fit: (id: string) => apiRequest<LabOrderRow>(`/lab-orders/${id}/fit`, { method: "PATCH" }),
  returnToLab: (id: string, body: ReturnLabOrderInput) =>
    apiRequest<LabOrderRow>(`/lab-orders/${id}/return`, { method: "PATCH", body }),
  cancel: (id: string, body: CancelLabOrderInput) =>
    apiRequest<LabOrderRow>(`/lab-orders/${id}/cancel`, { method: "PATCH", body }),

  attachments: (id: string) => apiRequest<LabOrderAttachment[]>(`/lab-orders/${id}/attachments`),

  presignAttachment: (id: string, body: PresignLabAttachmentInput) =>
    apiRequest<PresignAttachmentUploadResponse>(`/lab-orders/${id}/attachments/presign`, {
      method: "POST",
      body,
    }),

  confirmAttachment: (id: string, body: ConfirmLabAttachmentInput) =>
    apiRequest<LabOrderAttachment>(`/lab-orders/${id}/attachments`, { method: "POST", body }),

  deleteAttachment: (id: string, attachmentId: string) =>
    apiRequest<void>(`/lab-orders/${id}/attachments/${attachmentId}`, { method: "DELETE" }),

  sheetPdf: (id: string): Promise<Blob> => apiDownload(`/lab-orders/${id}/print`),
};
