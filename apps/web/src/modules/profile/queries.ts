import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { Passkey } from "@clinic/shared";
import { authApi } from "@web/shared/api/auth";
import { createPasskey } from "@web/shared/lib/passkeys";
import { PASSKEYS_KEY } from "@web/modules/profile/constants";

export function usePasskeys(): UseQueryResult<Passkey[]> {
  return useQuery({
    queryKey: [PASSKEYS_KEY],
    queryFn: () => authApi.passkeys(),
  });
}

export function useAddPasskey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createPasskey(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PASSKEYS_KEY] }),
  });
}

export function useRemovePasskey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => authApi.removePasskey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PASSKEYS_KEY] }),
  });
}
