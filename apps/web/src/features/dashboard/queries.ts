import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { DashboardSummary } from '@clinic/shared';

import { dashboardApi } from '@web/features/dashboard/api';

export const DASHBOARD_KEY = 'dashboard-summary';

/**
 * The landing page's data.
 *
 * Refetched when the window comes back into focus rather than on a timer: the
 * dashboard is the screen somebody returns to between patients, and the thing
 * that changes while they are away — an online booking, a payment at the desk
 * — is exactly what the cards are counting.
 */
export function useDashboardSummary(): UseQueryResult<DashboardSummary> {
  return useQuery({
    queryKey: [DASHBOARD_KEY],
    queryFn: () => dashboardApi.summary(),
    refetchOnWindowFocus: true,
    // Keeps the previous figures on screen while the next ones land, so the
    // three cards do not blink to zero and back on every return.
    placeholderData: (previous) => previous,
  });
}
