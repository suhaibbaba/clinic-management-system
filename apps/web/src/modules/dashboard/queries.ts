import { DASHBOARD_KEY } from "@web/shared/constants/query-keys";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type {
  DashboardCollections,
  DashboardVisits,
  OverduePatient,
  Paginated,
  DashboardLayout,
  DashboardLayouts,
  DashboardSummary,
  SaveDashboardLayoutsInput,
} from "@clinic/shared";
import { dashboardApi } from "@web/modules/dashboard/api";

const DASHBOARD_LAYOUT_KEY = "dashboard-layout";
const DASHBOARD_VISITS_KEY = "dashboard-visits-today";
const DASHBOARD_COLLECTIONS_KEY = "dashboard-collections";
const DASHBOARD_DEBTS_KEY = "dashboard-top-debts";
const DASHBOARD_LAYOUTS_KEY = "dashboard-layouts";

export function useDashboardSummary(): UseQueryResult<DashboardSummary> {
  return useQuery({
    queryKey: [DASHBOARD_KEY],
    queryFn: () => dashboardApi.summary(),
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });
}

export function useDashboardVisits(): UseQueryResult<DashboardVisits> {
  return useQuery({
    queryKey: [DASHBOARD_KEY, DASHBOARD_VISITS_KEY],
    queryFn: () => dashboardApi.visitsToday(),
    refetchOnWindowFocus: true,
  });
}

export function useDashboardCollections(): UseQueryResult<DashboardCollections> {
  return useQuery({
    queryKey: [DASHBOARD_KEY, DASHBOARD_COLLECTIONS_KEY],
    queryFn: () => dashboardApi.collections(),
    refetchOnWindowFocus: true,
  });
}

export function useDashboardTopDebts(): UseQueryResult<Paginated<OverduePatient>> {
  return useQuery({
    queryKey: [DASHBOARD_KEY, DASHBOARD_DEBTS_KEY],
    queryFn: () => dashboardApi.topDebts(),
    refetchOnWindowFocus: true,
  });
}

export function useDashboardLayout(): UseQueryResult<DashboardLayout> {
  return useQuery({
    queryKey: [DASHBOARD_LAYOUT_KEY],
    queryFn: () => dashboardApi.layout(),
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useDashboardLayouts(enabled: boolean): UseQueryResult<DashboardLayouts> {
  return useQuery({
    queryKey: [DASHBOARD_LAYOUTS_KEY],
    queryFn: () => dashboardApi.layouts(),
    enabled,
  });
}

export function useSaveDashboardLayouts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SaveDashboardLayoutsInput) => dashboardApi.saveLayouts(body),
    onSuccess: async (layouts) => {
      queryClient.setQueryData([DASHBOARD_LAYOUTS_KEY], layouts);
      await queryClient.invalidateQueries({ queryKey: [DASHBOARD_LAYOUT_KEY] });
    },
  });
}
