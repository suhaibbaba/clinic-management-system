import type { CalendarAppointment, ListAppointmentsQuery, Paginated } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";
import { toQueryString } from "@web/shared/lib/query-string";

export const listPendingBookings = (params: Partial<ListAppointmentsQuery> = {}) =>
  apiRequest<Paginated<CalendarAppointment>>(
    `/appointments/pending-confirmation${toQueryString(params)}`,
  );
