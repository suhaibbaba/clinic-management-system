import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@web/lib/api-error";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.statusCode < 500) {
            return false;
          }

          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
