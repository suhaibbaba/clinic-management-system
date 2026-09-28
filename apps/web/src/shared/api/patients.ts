import type { ListPatientsQuery, PatientView, Paginated } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const listPatients = (query: Partial<ListPatientsQuery>): Promise<Paginated<PatientView>> =>
  apiRequest("/patients", {
    query: {
      page: query.page,
      limit: query.limit,
      search: query.search,
      hasBalance: query.hasBalance,
      visitedSince: query.visitedSince,
      sort: query.sort,
      dir: query.dir,
    },
  });
