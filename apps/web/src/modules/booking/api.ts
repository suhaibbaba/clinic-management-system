import { listPendingBookings } from "@web/shared/api/booking";
import type { CalendarAppointment } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

const BASE = "/appointments/pending-confirmation";

export const pendingBookingsApi = {
  list: listPendingBookings,

  confirm: (id: string) =>
    apiRequest<CalendarAppointment>(`${BASE}/${id}/confirm`, { method: "PATCH" }),

  reject: (id: string, reason: string) =>
    apiRequest<CalendarAppointment>(`${BASE}/${id}/reject`, {
      method: "PATCH",
      body: { reason },
    }),
};
