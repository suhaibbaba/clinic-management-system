import { useCalendarMutation } from "@web/shared/queries/appointments";
import { WAITING_LIST_KEY, CALENDAR_KEY, AVAILABILITY_KEY } from "@web/shared/constants/query-keys";
import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
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
  WaitingListEntry,
} from "@clinic/shared";
import { appointmentsApi, waitingListApi } from "@web/modules/appointments/api";

export function useAppointments(
  query: Partial<ListAppointmentsQuery>,
): UseQueryResult<Paginated<CalendarAppointment>> {
  return useQuery({
    queryKey: [CALENDAR_KEY, "list", query],
    queryFn: () => appointmentsApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useAvailability(
  query: Partial<AvailabilityQuery>,
  enabled = true,
): UseQueryResult<Availability> {
  const ready = Boolean(query.doctorId && query.date) && enabled;

  return useQuery({
    queryKey: [AVAILABILITY_KEY, query],
    queryFn: () => appointmentsApi.availability(query as AvailabilityQuery),
    enabled: ready,
    staleTime: 0,
  });
}

export function useDayAvailability(
  date: string,
  doctorIds: readonly string[],
  stepMinutes: number,
  enabled: boolean,
): ReadonlyMap<string, Availability> {
  return useQueries({
    queries: doctorIds.map((doctorId) => {
      const query: AvailabilityQuery = { doctorId, date, durationMinutes: stepMinutes };

      return {
        queryKey: [AVAILABILITY_KEY, query],
        queryFn: () => appointmentsApi.availability(query),
        enabled,
      };
    }),
    combine: (results) =>
      new Map(
        results.flatMap((result) => (result.data ? [[result.data.doctorId, result.data]] : [])),
      ),
  });
}

export function useWaitingList(
  query: Partial<ListWaitingListQuery> = {},
  enabled = true,
): UseQueryResult<Paginated<WaitingListEntry>> {
  return useQuery({
    queryKey: [WAITING_LIST_KEY, query],
    queryFn: () => waitingListApi.list(query),
    enabled,
  });
}

export const useCreateAppointment = () =>
  useCalendarMutation((body: CreateAppointmentInput) => appointmentsApi.create(body));

export const useUpdateAppointment = () =>
  useCalendarMutation(({ id, body }: { id: string; body: UpdateAppointmentInput }) =>
    appointmentsApi.update(id, body),
  );

export const useCancelAppointment = () =>
  useCalendarMutation(({ id, reason }: { id: string; reason: string }) =>
    appointmentsApi.cancel(id, reason),
  );

export const useConvertToVisit = () =>
  useCalendarMutation((id: string) => appointmentsApi.convertToVisit(id));

export const useAddToWaitingList = () =>
  useCalendarMutation((body: CreateWaitingListEntryInput) => waitingListApi.create(body));

export const usePromoteWaitingEntry = () =>
  useCalendarMutation(({ id, body }: { id: string; body: PromoteWaitingListEntryInput }) =>
    waitingListApi.promote(id, body),
  );

export const useContactWaitingEntry = () =>
  useCalendarMutation((id: string) => waitingListApi.markContacted(id));

export const useDeclineWaitingEntry = () =>
  useCalendarMutation(({ id, body }: { id: string; body: DeclineWaitingListEntryInput }) =>
    waitingListApi.decline(id, body),
  );
