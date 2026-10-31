import type {
  CreateSpecialtyInput,
  Paginated,
  Specialty,
  UpdateSpecialtyInput,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const specialtiesApi = {
  list: (): Promise<Paginated<Specialty>> => apiRequest("/specialties", { query: { limit: 100 } }),

  create: (body: CreateSpecialtyInput): Promise<Specialty> =>
    apiRequest("/specialties", { method: "POST", body }),

  update: (id: string, body: UpdateSpecialtyInput): Promise<Specialty> =>
    apiRequest(`/specialties/${id}`, { method: "PATCH", body }),
};
