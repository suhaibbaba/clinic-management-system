import type { Paginated, Specialty, UpdateSpecialtyInput } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const specialtiesApi = {
  list: (): Promise<Paginated<Specialty>> => apiRequest("/specialties", { query: { limit: 100 } }),
  update: (id: string, body: UpdateSpecialtyInput): Promise<Specialty> =>
    apiRequest(`/specialties/${id}`, { method: "PATCH", body }),
};
