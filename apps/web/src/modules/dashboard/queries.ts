import { DASHBOARD_KEY } from "@web/shared/constants/query-keys";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { DashboardSummary } from "@clinic/shared";
import { dashboardApi } from "@web/modules/dashboard/api";

export function useDashboardSummary(): UseQueryResult<DashboardSummary> {
  return useQuery({
    queryKey: [DASHBOARD_KEY],
    queryFn: () => dashboardApi.summary(),
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });
}
