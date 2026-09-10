import { dashboardSummarySchema, type DashboardSummary } from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

// Parsed with the shared schema rather than cast: the response is shaped by role, and the page has
// to tell "not for you" from "not sent yet".
export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> =>
    dashboardSummarySchema.parse(await apiRequest('/dashboard/summary')),
};
