import { CALENDAR_KEY, AVAILABILITY_KEY, WAITING_LIST_KEY } from "@web/shared/constants/query-keys";
import { useQueryClient, useMutation, type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { CalendarQuery, CalendarFeed } from "@clinic/shared";
import { calendarApi } from "@web/shared/api/appointments";

const CALENDAR_KEYS = [CALENDAR_KEY, AVAILABILITY_KEY, WAITING_LIST_KEY];

export function useCalendarMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
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

export function useCalendar(query: CalendarQuery): UseQueryResult<CalendarFeed> {
  return useQuery({
    queryKey: [CALENDAR_KEY, query],
    queryFn: () => calendarApi.calendar(query),
    placeholderData: (previous) => previous,
  });
}

export type AppointmentStep = "confirm" | "arrived" | "start" | "complete" | "noShow";

export const useAppointmentStep = () =>
  useCalendarMutation(({ id, step }: { id: string; step: AppointmentStep }) =>
    calendarApi[step](id),
  );
