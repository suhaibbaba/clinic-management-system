import type { Doctor, ListDoctorsQuery, Paginated } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const listDoctors = (query: Partial<ListDoctorsQuery>): Promise<Paginated<Doctor>> =>
  apiRequest("/doctors", {
    query: { page: query.page, limit: query.limit, search: query.search },
  });
