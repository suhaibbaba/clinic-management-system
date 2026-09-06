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

/**
 * The reception side of public booking.
 *
 * `requested` *is* the marker for "came from the booking page" — reception's
 * own bookings are created confirmed — so this is one filtered read of the
 * appointments list plus the two decisions only these bookings need. Confirm
 * and reject are their own endpoints rather than the calendar's generic
 * transitions because they also send the patient a message: they are not in
 * the building, and a decision they never hear about is not a decision.
 */
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
