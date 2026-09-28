import { dashboardSummarySchema, type DashboardSummary } from "@clinic/shared";
import { apiRequest } from "@web/lib/api-client";

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> =>
    dashboardSummarySchema.parse(await apiRequest("/dashboard/summary")),
};
