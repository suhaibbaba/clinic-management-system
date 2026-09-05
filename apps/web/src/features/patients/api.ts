import type {
  AllergyFlags,
  Attachment,
  CreatePerformedProcedureInput,
  Paginated,
  PatientClinicalView,
  PerformedProcedure,
  ProcedureCatalogItem,
  ToothHistory,
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
};
