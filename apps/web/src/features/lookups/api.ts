import type {
  CreateLookupOptionInput,
  LookupBundle,
  LookupOption,
  ReorderLookupOptionsInput,
  UpdateLookupOptionInput,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

export const lookupsApi = {
  /** The whole bundle in one request; see `useLookups` for why. */
  bundle: (includeInactive = false): Promise<LookupBundle> =>
    apiRequest('/lookups', { query: { includeInactive: includeInactive || undefined } }),
  create: (body: CreateLookupOptionInput): Promise<LookupOption> =>
    apiRequest('/lookups', { method: 'POST', body }),
  update: (id: string, body: UpdateLookupOptionInput): Promise<LookupOption> =>
    apiRequest(`/lookups/${id}`, { method: 'PATCH', body }),
  reorder: (body: ReorderLookupOptionsInput): Promise<LookupOption[]> =>
    apiRequest('/lookups/reorder', { method: 'PATCH', body }),
  remove: (id: string): Promise<void> => apiRequest(`/lookups/${id}`, { method: 'DELETE' }),
};
