import type { CalendarAppointment, ListAppointmentsQuery, Paginated } from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

const query = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  return search.size > 0 ? `?${search.toString()}` : '';
};

const BASE = '/appointments/pending-confirmation';

// `requested` is the marker for "came from the booking page". Confirm and reject are their own
// endpoints because they also message the patient, who is not in the building.
export const pendingBookingsApi = {
  list: (params: Partial<ListAppointmentsQuery> = {}) =>
    apiRequest<Paginated<CalendarAppointment>>(`${BASE}${query(params)}`),

  confirm: (id: string) =>
    apiRequest<CalendarAppointment>(`${BASE}/${id}/confirm`, { method: 'PATCH' }),

  reject: (id: string, reason: string) =>
    apiRequest<CalendarAppointment>(`${BASE}/${id}/reject`, {
      method: 'PATCH',
      body: { reason },
    }),
};
