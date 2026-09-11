import {
  clinicNoteSchema,
  paginatedSchema,
  type ClinicNote,
  type CreateClinicNoteInput,
  type Paginated,
  type UpdateClinicNoteInput,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

const listSchema = paginatedSchema(clinicNoteSchema);

export const notesApi = {
  list: async (limit: number): Promise<Paginated<ClinicNote>> =>
    listSchema.parse(await apiRequest('/notes', { query: { limit } })),

  create: (body: CreateClinicNoteInput): Promise<ClinicNote> =>
    apiRequest<ClinicNote>('/notes', { method: 'POST', body }),

  update: (id: string, body: UpdateClinicNoteInput): Promise<ClinicNote> =>
    apiRequest<ClinicNote>(`/notes/${id}`, { method: 'PATCH', body }),

  remove: (id: string): Promise<void> => apiRequest<void>(`/notes/${id}`, { method: 'DELETE' }),
};
