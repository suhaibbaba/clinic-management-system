import type {
  CreateDoctorInput,
  Doctor,
  ListDoctorsQuery,
  Paginated,
  Specialty,
  UpdateDoctorInput,
  UpdateDoctorScheduleInput,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

export const doctorsApi = {
  list: (query: Partial<ListDoctorsQuery>): Promise<Paginated<Doctor>> =>
    apiRequest('/doctors', {
      query: { page: query.page, limit: query.limit, search: query.search },
    }),

  create: (body: CreateDoctorInput): Promise<Doctor> =>
    apiRequest('/doctors', { method: 'POST', body }),

  update: (id: string, body: UpdateDoctorInput): Promise<Doctor> =>
    apiRequest(`/doctors/${id}`, { method: 'PATCH', body }),

  updateSchedule: (id: string, body: UpdateDoctorScheduleInput): Promise<Doctor> =>
    apiRequest(`/doctors/${id}/schedule`, { method: 'PATCH', body }),

  specialties: (): Promise<Paginated<Specialty>> =>
    apiRequest('/specialties', { query: { limit: 100 } }),
};
