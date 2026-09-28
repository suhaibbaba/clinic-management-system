import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { CalendarAppointment, ListAppointmentsQuery, Paginated } from "@clinic/shared";
import { pendingBookingsApi } from "@web/api/booking";
import { CALENDAR_KEY } from "@web/queries/appointments";

export const PENDING_BOOKINGS_KEY = "pending-bookings";

export function usePendingBookings(
  params: Partial<ListAppointmentsQuery> = {},
  enabled = true,
): UseQueryResult<Paginated<CalendarAppointment>> {
  return useQuery({
    queryKey: [PENDING_BOOKINGS_KEY, params],
    queryFn: () => pendingBookingsApi.list(params),
    placeholderData: (previous) => previous,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function usePendingBookingsCount(enabled = true): number {
  const query = usePendingBookings({ limit: 1 }, enabled);

  return query.data?.total ?? 0;
}

function usePendingMutation<TArgs>(mutationFn: (args: TArgs) => Promise<CalendarAppointment>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PENDING_BOOKINGS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [CALENDAR_KEY] });
    },
  });
}

export function useConfirmBooking() {
  return usePendingMutation((id: string) => pendingBookingsApi.confirm(id));
}

export function useRejectBooking() {
  return usePendingMutation(({ id, reason }: { id: string; reason: string }) =>
    pendingBookingsApi.reject(id, reason),
  );
}
