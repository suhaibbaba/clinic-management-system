import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { DashboardSummary } from "@clinic/shared";
import { dashboardApi } from "@web/features/dashboard/api";

export const DASHBOARD_KEY = "dashboard-summary";

export function useDashboardSummary(): UseQueryResult<DashboardSummary> {
  return useQuery({
    queryKey: [DASHBOARD_KEY],
    queryFn: () => dashboardApi.summary(),
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });
}
