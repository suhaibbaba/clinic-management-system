import type {
  CreateSpecialtyInput,
  Paginated,
  Specialty,
  UpdateSpecialtyInput,
} from "@clinic/shared";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { specialtiesApi } from "@web/shared/api/specialties";
import { useSession } from "@web/shared/providers/session";

const SPECIALTIES_KEY = "specialties";

export function useSpecialties(): UseQueryResult<Paginated<Specialty>> {
  return useQuery({ queryKey: [SPECIALTIES_KEY], queryFn: () => specialtiesApi.list() });
}

function useSpecialtiesChanged(): () => Promise<void> {
  const queryClient = useQueryClient();
  const { refreshProfile } = useSession();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [SPECIALTIES_KEY] }),
      refreshProfile(),
    ]);
  };
}

export function useCreateSpecialty() {
  const changed = useSpecialtiesChanged();

  return useMutation({
    mutationFn: (body: CreateSpecialtyInput) => specialtiesApi.create(body),
    onSuccess: changed,
  });
}

export function useUpdateSpecialty() {
  const changed = useSpecialtiesChanged();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSpecialtyInput }) =>
      specialtiesApi.update(id, body),
    onSuccess: changed,
  });
}
