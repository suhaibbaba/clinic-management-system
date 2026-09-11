import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
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
  WaitingListEntry,
} from '@clinic/shared';

import { appointmentsApi, waitingListApi } from '@web/features/appointments/api';

export const CALENDAR_KEY = 'appointments-calendar';
export const AVAILABILITY_KEY = 'appointments-availability';
export const WAITING_LIST_KEY = 'waiting-list';

// Every write invalidates the calendar, the day's availability and the waiting list: getting one
// wrong leaves a slot on screen that is no longer free.
const CALENDAR_KEYS = [CALENDAR_KEY, AVAILABILITY_KEY, WAITING_LIST_KEY];

function useCalendarMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of CALENDAR_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

// A different question from the calendar feed, so a different endpoint — kept on the calendar's key
// prefix so any write invalidates it too.
export function useAppointments(
  query: Partial<ListAppointmentsQuery>,
): UseQueryResult<Paginated<CalendarAppointment>> {
  return useQuery({
    queryKey: [CALENDAR_KEY, 'list', query],
    queryFn: () => appointmentsApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useCalendar(query: CalendarQuery): UseQueryResult<CalendarFeed> {
  return useQuery({
    queryKey: [CALENDAR_KEY, query],
    queryFn: () => appointmentsApi.calendar(query),
    // Keeps the week on screen while the next one loads, so paging through the
    // calendar does not blink empty.
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
    // Slots go stale the moment anyone else books one.
    staleTime: 0,
  });
}

export function useWaitingList(
  query: Partial<ListWaitingListQuery> = {},
): UseQueryResult<Paginated<WaitingListEntry>> {
  return useQuery({
    queryKey: [WAITING_LIST_KEY, query],
    queryFn: () => waitingListApi.list(query),
  });
}

export const useCreateAppointment = () =>
  useCalendarMutation((body: CreateAppointmentInput) => appointmentsApi.create(body));

export const useUpdateAppointment = () =>
  useCalendarMutation(({ id, body }: { id: string; body: UpdateAppointmentInput }) =>
    appointmentsApi.update(id, body),
  );

// One hook rather than six: they differ only in which endpoint they call, and six near-identical
// hooks is six places to forget an invalidation.
export type AppointmentStep = 'confirm' | 'arrived' | 'start' | 'complete' | 'noShow';

export const useAppointmentStep = () =>
  useCalendarMutation(({ id, step }: { id: string; step: AppointmentStep }) =>
    appointmentsApi[step](id),
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

export const useResolveWaitingEntry = () =>
  useCalendarMutation((id: string) => waitingListApi.resolve(id));
