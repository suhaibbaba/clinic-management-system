import {
  DASHBOARD_LIST_LIMIT,
  dashboardCollectionsSchema,
  dashboardVisitsSchema,
  overduePatientSchema,
  paginatedSchema,
  dashboardLayoutSchema,
  dashboardLayoutsSchema,
  dashboardSummarySchema,
  type DashboardCollections,
  type DashboardVisits,
  type OverduePatient,
  type Paginated,
  type DashboardLayout,
  type DashboardLayouts,
  type DashboardSummary,
  type SaveDashboardLayoutsInput,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> =>
    dashboardSummarySchema.parse(await apiRequest("/dashboard/summary")),
  visitsToday: async (): Promise<DashboardVisits> =>
    dashboardVisitsSchema.parse(await apiRequest("/dashboard/visits-today")),
  collections: async (): Promise<DashboardCollections> =>
    dashboardCollectionsSchema.parse(await apiRequest("/dashboard/collections")),
  topDebts: async (): Promise<Paginated<OverduePatient>> =>
    paginatedSchema(overduePatientSchema).parse(
      await apiRequest(`/billing/overdue?limit=${DASHBOARD_LIST_LIMIT}`),
    ),
  layout: async (): Promise<DashboardLayout> =>
    dashboardLayoutSchema.parse(await apiRequest("/dashboard/layout")),
  layouts: async (): Promise<DashboardLayouts> =>
    dashboardLayoutsSchema.parse(await apiRequest("/dashboard/layouts")),
  saveLayouts: async (body: SaveDashboardLayoutsInput): Promise<DashboardLayouts> =>
    dashboardLayoutsSchema.parse(await apiRequest("/dashboard/layouts", { method: "PUT", body })),
};
