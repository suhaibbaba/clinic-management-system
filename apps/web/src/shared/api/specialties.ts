import type { Paginated, Specialty } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const specialtiesApi = {
  list: (): Promise<Paginated<Specialty>> => apiRequest("/specialties", { query: { limit: 100 } }),
};
