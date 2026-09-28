import type { ListAppointmentsQuery, Paginated, CalendarAppointment } from "@clinic/shared";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { PENDING_BOOKINGS_KEY } from "@web/shared/constants/query-keys";
import { listPendingBookings } from "@web/shared/api/booking";

export function usePendingBookings(
  params: Partial<ListAppointmentsQuery> = {},
  enabled = true,
): UseQueryResult<Paginated<CalendarAppointment>> {
  return useQuery({
    queryKey: [PENDING_BOOKINGS_KEY, params],
    queryFn: () => listPendingBookings(params),
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
