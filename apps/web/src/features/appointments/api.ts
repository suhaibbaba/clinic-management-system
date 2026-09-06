import type {
  Availability,
  AvailabilityQuery,
  CalendarAppointment,
  CalendarFeed,
  CalendarQuery,
  CreateAppointmentInput,
  CreateWaitingListEntryInput,
  ListAppointmentsQuery,
  ListWaitingListQuery,
  Paginated,
  PromoteWaitingListEntryInput,
  UpdateAppointmentInput,
  Visit,
  WaitingListEntry,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

const query = (params: Record<string, string | number | boolean | undefined>): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  return search.size > 0 ? `?${search.toString()}` : '';
};

export const appointmentsApi = {
  list: (params: Partial<ListAppointmentsQuery>) =>
    apiRequest<Paginated<CalendarAppointment>>(`/appointments${query(params)}`),

  calendar: (params: CalendarQuery) =>
    apiRequest<CalendarFeed>(`/appointments/calendar${query({ ...params })}`),

  availability: (params: AvailabilityQuery) =>
    apiRequest<Availability>(`/appointments/availability${query({ ...params })}`),

  create: (body: CreateAppointmentInput) =>
    apiRequest<CalendarAppointment>('/appointments', { method: 'POST', body }),

  update: (id: string, body: UpdateAppointmentInput) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}`, { method: 'PATCH', body }),

  /**
   * The transition endpoints, one per act.
   *
   * Named after what the front desk presses rather than after a status field,
   * which is what makes both the audit trail and this object readable.
   */
  confirm: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/confirm`, { method: 'PATCH' }),
  arrived: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/arrived`, { method: 'PATCH' }),
  start: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/start`, { method: 'PATCH' }),
  complete: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/complete`, { method: 'PATCH' }),
  noShow: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/no-show`, { method: 'PATCH' }),
  cancel: (id: string, reason: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/cancel`, {
      method: 'PATCH',
      body: { reason },
    }),

  convertToVisit: (id: string) =>
    apiRequest<Visit>(`/appointments/${id}/visit`, { method: 'POST' }),
};

export const waitingListApi = {
  list: (params: Partial<ListWaitingListQuery>) =>
    apiRequest<Paginated<WaitingListEntry>>(`/waiting-list${query(params)}`),

  create: (body: CreateWaitingListEntryInput) =>
    apiRequest<WaitingListEntry>('/waiting-list', { method: 'POST', body }),

  promote: (id: string, body: PromoteWaitingListEntryInput) =>
    apiRequest<WaitingListEntry>(`/waiting-list/${id}/promote`, { method: 'POST', body }),

  resolve: (id: string) =>
    apiRequest<WaitingListEntry>(`/waiting-list/${id}/resolve`, { method: 'PATCH' }),
};
