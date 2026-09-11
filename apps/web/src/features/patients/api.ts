import type {
  AllergyFlags,
  Attachment,
  ConfirmAttachmentUploadInput,
  CreatePatientInput,
  CreatePerformedProcedureInput,
  CreateTreatmentPlanInput,
  CreateTreatmentPlanItemInput,
  CreateVisitInput,
  ListAttachmentsQuery,
  ListPatientsQuery,
  ListTimelineQuery,
  Paginated,
  PatientClinicalView,
  PatientView,
  PerformedProcedure,
  PresignAttachmentUploadInput,
  PresignAttachmentUploadResponse,
  ProcedureCatalogItem,
  TimelineEntry,
  ToothHistory,
  TreatmentPlan,
  TreatmentPlanItem,
  UpdatePerformedProcedureInput,
  UpdateTreatmentPlanInput,
  UpdateTreatmentPlanItemInput,
  UpdateVisitInput,
  Visit,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

/** Server maximum for a page; the chart needs every row, so it pages through. */
const PAGE_LIMIT = 100;

// The chart colours all 32 teeth at once, so a patient with years of history cannot be drawn from
// page one. The bound stops a runaway loop on a malformed page.
async function fetchAllPages<TItem>(
  load: (page: number) => Promise<Paginated<TItem>>,
  maxPages = 20,
): Promise<TItem[]> {
  const first = await load(1);
  const items = [...first.items];

  for (let page = 2; page <= Math.min(first.totalPages, maxPages); page += 1) {
    const next = await load(page);
    items.push(...next.items);
  }

  return items;
}

export const patientsApi = {
  // Typed as the union, not the clinical view: the response shape is decided by the caller's role
  // server-side.
  list: (query: Partial<ListPatientsQuery>): Promise<Paginated<PatientView>> =>
    apiRequest('/patients', {
      query: {
        page: query.page,
        limit: query.limit,
        search: query.search,
        hasBalance: query.hasBalance,
        visitedSince: query.visitedSince,
      },
    }),

  create: (body: CreatePatientInput): Promise<PatientClinicalView> =>
    apiRequest('/patients', { method: 'POST', body }),

  get: (id: string): Promise<PatientClinicalView> => apiRequest(`/patients/${id}`),

  allergyFlags: (id: string): Promise<AllergyFlags> => apiRequest(`/patients/${id}/allergy-flags`),

  procedures: (patientId: string): Promise<PerformedProcedure[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<PerformedProcedure>>('/performed-procedures', {
        query: { patientId, page, limit: PAGE_LIMIT },
      }),
    ),

  catalog: (): Promise<ProcedureCatalogItem[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<ProcedureCatalogItem>>('/procedure-catalog', {
        query: { page, limit: PAGE_LIMIT, isActive: true },
      }),
    ),

  toothHistory: (patientId: string, fdi: number): Promise<ToothHistory> =>
    apiRequest(`/patients/${patientId}/teeth/${fdi}`),

  attachment: (id: string): Promise<Attachment> => apiRequest(`/attachments/${id}`),

  createProcedure: (body: CreatePerformedProcedureInput): Promise<PerformedProcedure> =>
    apiRequest('/performed-procedures', { method: 'POST', body }),

  updateProcedure: (id: string, body: UpdatePerformedProcedureInput): Promise<PerformedProcedure> =>
    apiRequest(`/performed-procedures/${id}`, { method: 'PATCH', body }),

  visits: (patientId: string): Promise<Visit[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<Visit>>('/visits', {
        query: { patientId, page, limit: PAGE_LIMIT },
      }),
    ),

  createVisit: (body: CreateVisitInput): Promise<Visit> =>
    apiRequest('/visits', { method: 'POST', body }),

  updateVisit: (id: string, body: UpdateVisitInput): Promise<Visit> =>
    apiRequest(`/visits/${id}`, { method: 'PATCH', body }),

  treatmentPlans: (patientId: string): Promise<TreatmentPlan[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<TreatmentPlan>>('/treatment-plans', {
        query: { patientId, page, limit: PAGE_LIMIT },
      }),
    ),

  createTreatmentPlan: (body: CreateTreatmentPlanInput): Promise<TreatmentPlan> =>
    apiRequest('/treatment-plans', { method: 'POST', body }),

  updateTreatmentPlan: (id: string, body: UpdateTreatmentPlanInput): Promise<TreatmentPlan> =>
    apiRequest(`/treatment-plans/${id}`, { method: 'PATCH', body }),

  addPlanItem: (planId: string, body: CreateTreatmentPlanItemInput): Promise<TreatmentPlanItem> =>
    apiRequest(`/treatment-plans/${planId}/items`, { method: 'POST', body }),

  updatePlanItem: (
    itemId: string,
    body: UpdateTreatmentPlanItemInput,
  ): Promise<TreatmentPlanItem> => apiRequest(`/plan-items/${itemId}`, { method: 'PATCH', body }),

  convertPlanItem: (itemId: string): Promise<PerformedProcedure> =>
    apiRequest(`/plan-items/${itemId}/convert`, { method: 'POST', body: {} }),

  attachments: (
    patientId: string,
    query: Partial<ListAttachmentsQuery> = {},
  ): Promise<Attachment[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<Attachment>>(`/patients/${patientId}/attachments`, {
        query: { page, limit: PAGE_LIMIT, type: query.type, tooth: query.tooth },
      }),
    ),

  presignUpload: (
    patientId: string,
    body: PresignAttachmentUploadInput,
  ): Promise<PresignAttachmentUploadResponse> =>
    apiRequest(`/patients/${patientId}/attachments/presign-upload`, { method: 'POST', body }),

  confirmUpload: (patientId: string, body: ConfirmAttachmentUploadInput): Promise<Attachment> =>
    apiRequest(`/patients/${patientId}/attachments/confirm`, { method: 'POST', body }),

  deleteAttachment: (id: string): Promise<void> =>
    apiRequest(`/attachments/${id}`, { method: 'DELETE' }),

  /** Which entry types come back is decided by the caller's role, not by this query. */
  timeline: (
    patientId: string,
    query: Partial<ListTimelineQuery> = {},
  ): Promise<Paginated<TimelineEntry>> =>
    apiRequest(`/patients/${patientId}/timeline`, {
      query: { page: query.page, limit: query.limit ?? 50, type: query.type },
    }),
};

// Not `apiRequest`: a presigned PUT must not carry the API's bearer token, and the body is the file
// rather than JSON.
export async function uploadToStorage(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}
