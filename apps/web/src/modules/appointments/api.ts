import { calendarApi } from "@web/shared/api/appointments";
import { toQueryString } from "@web/shared/lib/query-string";
import type {
  Availability,
  AvailabilityQuery,
  CalendarAppointment,
  CreateAppointmentInput,
  CreateWaitingListEntryInput,
  DeclineWaitingListEntryInput,
  ListAppointmentsQuery,
  ListWaitingListQuery,
  Paginated,
  PromoteWaitingListEntryInput,
  UpdateAppointmentInput,
  Visit,
  WaitingListEntry,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const appointmentsApi = {
  ...calendarApi,
  list: (params: Partial<ListAppointmentsQuery>) =>
    apiRequest<Paginated<CalendarAppointment>>(`/appointments${toQueryString(params)}`),

  availability: (params: AvailabilityQuery) =>
    apiRequest<Availability>(`/appointments/availability${toQueryString({ ...params })}`),

  create: (body: CreateAppointmentInput) =>
    apiRequest<CalendarAppointment>("/appointments", { method: "POST", body }),

  update: (id: string, body: UpdateAppointmentInput) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}`, { method: "PATCH", body }),

  cancel: (id: string, reason: string) =>
    apiRequest<CalendarAppointment>(`/appointments/${id}/cancel`, {
      method: "PATCH",
      body: { reason },
    }),

  convertToVisit: (id: string) =>
    apiRequest<Visit>(`/appointments/${id}/visit`, { method: "POST" }),
};

export const waitingListApi = {
  list: (params: Partial<ListWaitingListQuery>) =>
    apiRequest<Paginated<WaitingListEntry>>(`/waiting-list${toQueryString(params)}`),

  create: (body: CreateWaitingListEntryInput) =>
    apiRequest<WaitingListEntry>("/waiting-list", { method: "POST", body }),

  promote: (id: string, body: PromoteWaitingListEntryInput) =>
    apiRequest<WaitingListEntry>(`/waiting-list/${id}/promote`, { method: "POST", body }),

  markContacted: (id: string) =>
    apiRequest<WaitingListEntry>(`/waiting-list/${id}/contacted`, { method: "PATCH" }),

  decline: (id: string, body: DeclineWaitingListEntryInput) =>
    apiRequest<WaitingListEntry>(`/waiting-list/${id}/decline`, { method: "PATCH", body }),
};
