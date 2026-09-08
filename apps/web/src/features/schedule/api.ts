import type {
  ClinicClosure,
  ClinicClosureResult,
  CreateClinicClosureInput,
  CreateDoctorTimeOffInput,
  DoctorTimeOff,
  DoctorTimeOffResult,
  ListClinicClosuresQuery,
  ListDoctorTimeOffQuery,
  Paginated,
  ScheduleConflictOptions,
  UpdateClinicClosureInput,
  UpdateDoctorTimeOffInput,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

/**
 * `force` and `cancelAppointments` are query parameters, not body fields:
 * they are what the caller decided about the 409 they were shown, not part of
 * the closure. A row that stored "I was forced" would be recording an
 * interaction rather than a fact.
 */
const options = (choice: Partial<ScheduleConflictOptions> | undefined) => ({
  ...(choice?.force && { force: 'true' }),
  ...(choice?.cancelAppointments && { cancelAppointments: 'true' }),
});

export const closuresApi = {
  list: (query: Partial<ListClinicClosuresQuery> = {}): Promise<Paginated<ClinicClosure>> =>
    apiRequest('/clinic-closures', {
      query: { page: query.page, limit: query.limit, from: query.from, to: query.to },
    }),

  create: (
    body: CreateClinicClosureInput,
    choice?: Partial<ScheduleConflictOptions>,
  ): Promise<ClinicClosureResult> =>
    apiRequest('/clinic-closures', { method: 'POST', body, query: options(choice) }),

  update: (
    id: string,
    body: UpdateClinicClosureInput,
    choice?: Partial<ScheduleConflictOptions>,
  ): Promise<ClinicClosureResult> =>
    apiRequest(`/clinic-closures/${id}`, { method: 'PATCH', body, query: options(choice) }),

  remove: (id: string): Promise<void> => apiRequest(`/clinic-closures/${id}`, { method: 'DELETE' }),
};

export const timeOffApi = {
  list: (
    doctorId: string,
    query: Partial<ListDoctorTimeOffQuery> = {},
  ): Promise<Paginated<DoctorTimeOff>> =>
    apiRequest(`/doctors/${doctorId}/time-off`, {
      query: { page: query.page, limit: query.limit, from: query.from, to: query.to },
    }),

  create: (
    doctorId: string,
    body: CreateDoctorTimeOffInput,
    choice?: Partial<ScheduleConflictOptions>,
  ): Promise<DoctorTimeOffResult> =>
    apiRequest(`/doctors/${doctorId}/time-off`, { method: 'POST', body, query: options(choice) }),

  update: (
    id: string,
    body: UpdateDoctorTimeOffInput,
    choice?: Partial<ScheduleConflictOptions>,
  ): Promise<DoctorTimeOffResult> =>
    apiRequest(`/doctor-time-off/${id}`, { method: 'PATCH', body, query: options(choice) }),

  remove: (id: string): Promise<void> => apiRequest(`/doctor-time-off/${id}`, { method: 'DELETE' }),
};
