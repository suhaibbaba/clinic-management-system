import { dashboardSummarySchema, type DashboardSummary } from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

/**
 * The landing page's figures, in one request.
 *
 * Parsed with the shared schema rather than cast: the response is shaped by
 * role — a technician's carries no money and a doctor's no booking queue — so
 * the page has to be able to tell "not for you" from "not sent yet", and a
 * cast would hand it `undefined` for both.
 */
export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> =>
    dashboardSummarySchema.parse(await apiRequest('/dashboard/summary')),
};
