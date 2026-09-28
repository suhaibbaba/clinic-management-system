import { PENDING_BOOKINGS_KEY, CALENDAR_KEY } from "@web/shared/constants/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CalendarAppointment } from "@clinic/shared";
import { pendingBookingsApi } from "@web/modules/booking/api";

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
