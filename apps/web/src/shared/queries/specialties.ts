import type { Paginated, Specialty, UpdateSpecialtyInput } from "@clinic/shared";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { specialtiesApi } from "@web/shared/api/specialties";

const SPECIALTIES_KEY = "specialties";

export function useSpecialties(): UseQueryResult<Paginated<Specialty>> {
  return useQuery({ queryKey: [SPECIALTIES_KEY], queryFn: () => specialtiesApi.list() });
}

export function useUpdateSpecialty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSpecialtyInput }) =>
      specialtiesApi.update(id, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [SPECIALTIES_KEY] });
    },
  });
}
