import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { DashboardSummary } from '@clinic/shared';

import { dashboardApi } from '@web/features/dashboard/api';

export const DASHBOARD_KEY = 'dashboard-summary';

// Refetched on focus rather than on a timer: this is the screen somebody returns to between
// patients, and what changed while they were away is what the cards count.
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
