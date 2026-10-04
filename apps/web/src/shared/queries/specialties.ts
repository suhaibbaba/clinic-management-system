import type { Paginated, Specialty } from "@clinic/shared";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { specialtiesApi } from "@web/shared/api/specialties";

const SPECIALTIES_KEY = "specialties";

export function useSpecialties(): UseQueryResult<Paginated<Specialty>> {
  return useQuery({ queryKey: [SPECIALTIES_KEY], queryFn: () => specialtiesApi.list() });
}
