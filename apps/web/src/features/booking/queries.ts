import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { CalendarAppointment, ListAppointmentsQuery, Paginated } from '@clinic/shared';

import { USER_ROLE, type UserRole } from '@clinic/shared';

import { pendingBookingsApi } from '@web/features/booking/api';
import { CALENDAR_KEY } from '@web/features/appointments/queries';

export const PENDING_BOOKINGS_KEY = 'pending-bookings';

/** Who is asked to deal with online bookings at all (ROLES.md appointments row). */
export const seesPendingBookings = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.RECEPTIONIST;

export function usePendingBookings(
  params: Partial<ListAppointmentsQuery> = {},
  enabled = true,
): UseQueryResult<Paginated<CalendarAppointment>> {
  return useQuery({
    queryKey: [PENDING_BOOKINGS_KEY, params],
    queryFn: () => pendingBookingsApi.list(params),
    enabled,
    // Somebody books while reception is looking at the list; a minute-old
    // count on a badge is worse than no badge.
    refetchInterval: 60_000,
  });
}

/**
 * Just the number, for the sidebar badge.
 *
 * `limit: 1` because the page of rows is not wanted here — only `total`, which
 * the API returns either way.
 */
export function usePendingBookingsCount(enabled = true): number {
  const query = usePendingBookings({ limit: 1 }, enabled);

  return query.data?.total ?? 0;
}

function usePendingMutation<TArgs>(mutationFn: (args: TArgs) => Promise<CalendarAppointment>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      // Both: the row leaves this list *and* appears (or stops appearing) on
      // the calendar, and a stale calendar is how a slot gets double-booked.
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
