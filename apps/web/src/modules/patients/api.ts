import { listPatients } from "@web/shared/api/patients";
import type {
  AllergyFlags,
  Attachment,
  ConfirmAttachmentUploadInput,
  CreatePatientInput,
  CreateProcedureCatalogItemInput,
  CreatePerformedProcedureInput,
  CreatePrescriptionInput,
  CreateVisitInput,
  ListAttachmentsQuery,
  ListTimelineQuery,
  Paginated,
  PatientClinicalView,
  PerformedProcedure,
  Prescription,
  PresignAttachmentUploadInput,
  PresignAttachmentUploadResponse,
  ProcedureCatalogItem,
  TimelineEntry,
  UpdatePatientInput,
  UpdatePerformedProcedureInput,
  UpdatePrescriptionInput,
  UpdateProcedureCatalogItemInput,
  UpdateVisitInput,
  Visit,
} from "@clinic/shared";
import { apiDownload, apiRequest } from "@web/shared/lib/api-client";

const PAGE_LIMIT = 100;

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
  list: listPatients,

  create: (body: CreatePatientInput): Promise<PatientClinicalView> =>
    apiRequest("/patients", { method: "POST", body }),

  get: (id: string): Promise<PatientClinicalView> => apiRequest(`/patients/${id}`),

  update: (id: string, body: UpdatePatientInput): Promise<PatientClinicalView> =>
    apiRequest(`/patients/${id}`, { method: "PATCH", body }),

  remove: (id: string): Promise<void> => apiRequest(`/patients/${id}`, { method: "DELETE" }),

  allergyFlags: (id: string): Promise<AllergyFlags> => apiRequest(`/patients/${id}/allergy-flags`),

  procedures: (patientId: string): Promise<PerformedProcedure[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<PerformedProcedure>>("/performed-procedures", {
        query: { patientId, page, limit: PAGE_LIMIT },
      }),
    ),

  catalog: (): Promise<ProcedureCatalogItem[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<ProcedureCatalogItem>>("/procedure-catalog", {
        query: { page, limit: PAGE_LIMIT, isActive: true },
      }),
    ),

  priceList: (): Promise<ProcedureCatalogItem[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<ProcedureCatalogItem>>("/procedure-catalog", {
        query: { page, limit: PAGE_LIMIT },
      }),
    ),

  createCatalogItem: (body: CreateProcedureCatalogItemInput): Promise<ProcedureCatalogItem> =>
    apiRequest("/procedure-catalog", { method: "POST", body }),

  updateCatalogItem: (
    id: string,
    body: UpdateProcedureCatalogItemInput,
  ): Promise<ProcedureCatalogItem> =>
    apiRequest(`/procedure-catalog/${id}`, { method: "PATCH", body }),

  removeCatalogItem: (id: string): Promise<void> =>
    apiRequest(`/procedure-catalog/${id}`, { method: "DELETE" }),

  treatmentPlanPdf: (patientId: string): Promise<Blob> =>
    apiDownload(`/patients/${patientId}/treatment-plan.pdf`),

  sendTreatmentPlan: (patientId: string, to: string): Promise<void> =>
    apiRequest(`/patients/${patientId}/treatment-plan/whatsapp`, { method: "POST", body: { to } }),

  attachment: (id: string): Promise<Attachment> => apiRequest(`/attachments/${id}`),

  createProcedure: (body: CreatePerformedProcedureInput): Promise<PerformedProcedure> =>
    apiRequest("/performed-procedures", { method: "POST", body }),

  updateProcedure: (id: string, body: UpdatePerformedProcedureInput): Promise<PerformedProcedure> =>
    apiRequest(`/performed-procedures/${id}`, { method: "PATCH", body }),

  removeProcedure: (id: string): Promise<void> =>
    apiRequest(`/performed-procedures/${id}`, { method: "DELETE" }),

  removeVisit: (id: string): Promise<void> => apiRequest(`/visits/${id}`, { method: "DELETE" }),

  visits: (patientId: string): Promise<Visit[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<Visit>>("/visits", {
        query: { patientId, page, limit: PAGE_LIMIT },
      }),
    ),

  createVisit: (body: CreateVisitInput): Promise<Visit> =>
    apiRequest("/visits", { method: "POST", body }),

  updateVisit: (id: string, body: UpdateVisitInput): Promise<Visit> =>
    apiRequest(`/visits/${id}`, { method: "PATCH", body }),

  prescriptions: (patientId: string): Promise<Prescription[]> =>
    fetchAllPages((page) =>
      apiRequest<Paginated<Prescription>>("/prescriptions", {
        query: { patientId, page, limit: PAGE_LIMIT },
      }),
    ),

  createPrescription: (body: CreatePrescriptionInput): Promise<Prescription> =>
    apiRequest("/prescriptions", { method: "POST", body }),

  updatePrescription: (id: string, body: UpdatePrescriptionInput): Promise<Prescription> =>
    apiRequest(`/prescriptions/${id}`, { method: "PATCH", body }),

  removePrescription: (id: string): Promise<void> =>
    apiRequest(`/prescriptions/${id}`, { method: "DELETE" }),

  prescriptionPdf: (id: string): Promise<Blob> => apiDownload(`/prescriptions/${id}/print`),

  sendPrescription: (id: string, to: string): Promise<void> =>
    apiRequest(`/prescriptions/${id}/print/whatsapp`, { method: "POST", body: { to } }),

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
    apiRequest(`/patients/${patientId}/attachments/presign-upload`, { method: "POST", body }),

  confirmUpload: (patientId: string, body: ConfirmAttachmentUploadInput): Promise<Attachment> =>
    apiRequest(`/patients/${patientId}/attachments/confirm`, { method: "POST", body }),

  deleteAttachment: (id: string): Promise<void> =>
    apiRequest(`/attachments/${id}`, { method: "DELETE" }),

  timeline: (
    patientId: string,
    query: Partial<ListTimelineQuery> = {},
  ): Promise<Paginated<TimelineEntry>> =>
    apiRequest(`/patients/${patientId}/timeline`, {
      query: { page: query.page, limit: query.limit ?? 50, type: query.type },
    }),
};
