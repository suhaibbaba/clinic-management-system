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
  Paginated,
  PatientClinicalView,
  PatientView,
  PerformedProcedure,
  PresignAttachmentUploadInput,
  PresignAttachmentUploadResponse,
  ProcedureCatalogItem,
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

/**
 * Reads every page of a list endpoint.
 *
 * The chart colours all 32 teeth at once, so a patient with years of history
 * cannot be shown from page one alone. The bound keeps a runaway loop from
 * hammering the API if a page ever comes back malformed.
 */
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
  /**
   * The list every role may read. The response shape is decided by the caller's
   * role server-side — a receptionist or a technician receives
   * `PatientPublicView`, so this is typed as the union rather than the
   * clinical view (ROLES.md field-level security).
   */
  list: (query: Partial<ListPatientsQuery>): Promise<Paginated<PatientView>> =>
    apiRequest('/patients', {
      query: { page: query.page, limit: query.limit, search: query.search },
    }),

  create: (body: CreatePatientInput): Promise<PatientClinicalView> =>
    apiRequest('/patients', { method: 'POST', body }),

  get: (id: string): Promise<PatientClinicalView> => apiRequest(`/patients/${id}`),

  /**
   * Allergies only. The full medical history would do, but this endpoint is the
   * narrower one and the banner needs nothing else (ROLES.md: least privilege).
   */
  allergyFlags: (id: string): Promise<AllergyFlags> => apiRequest(`/patients/${id}/allergy-flags`),

  /** Every procedure on the patient, each carrying its chart marks. */
  procedures: (patientId: string): Promise<PerformedProcedure[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<PerformedProcedure>>('/performed-procedures', {
        query: { patientId, page, limit: PAGE_LIMIT },
      }),
    ),

  /** The catalog, for its prices and its chart classification. */
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

  /* -------------------------------------------------------------------- */
  /* Visits                                                                */
  /* -------------------------------------------------------------------- */

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

  /* -------------------------------------------------------------------- */
  /* Treatment plans                                                       */
  /* -------------------------------------------------------------------- */

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

  /** Turns a quoted item into work actually carried out. */
  convertPlanItem: (itemId: string): Promise<PerformedProcedure> =>
    apiRequest(`/plan-items/${itemId}/convert`, { method: 'POST', body: {} }),

  /* -------------------------------------------------------------------- */
  /* Attachments                                                           */
  /* -------------------------------------------------------------------- */

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
};

/**
 * Uploads the bytes straight to storage.
 *
 * Deliberately not `apiRequest`: this is a presigned PUT to the object store,
 * which must not carry the API's bearer token, and the body is the file itself
 * rather than JSON.
 */
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
