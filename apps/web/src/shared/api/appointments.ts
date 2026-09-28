import type { CalendarAppointment, CalendarFeed, CalendarQuery } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";
import { toQueryString } from "@web/shared/lib/query-string";

export const calendarApi = {
  calendar: (params: CalendarQuery) =>
    apiRequest<CalendarFeed>(`/appointments/calendar${toQueryString({ ...params })}`),

  confirm: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/confirm`, { method: "PATCH" }),
  arrived: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/arrived`, { method: "PATCH" }),
  start: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/start`, { method: "PATCH" }),
  complete: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/complete`, { method: "PATCH" }),
  noShow: (id: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/no-show`, { method: "PATCH" }),
};
