import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { AuthMethods } from "@clinic/shared";
import { authApi } from "@web/shared/api/auth";
import { AUTH_METHODS_KEY } from "@web/modules/auth/constants";

export function useAuthMethods(): UseQueryResult<AuthMethods> {
  return useQuery({
    queryKey: [AUTH_METHODS_KEY],
    queryFn: () => authApi.methods(),
    staleTime: Infinity,
  });
}
