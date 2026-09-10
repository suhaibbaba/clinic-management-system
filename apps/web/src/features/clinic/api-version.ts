import { versionResponseSchema, type VersionResponse } from '@clinic/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiRequest } from '@web/lib/api-client';

/** This bundle's version, fixed when it was built (`vite.config.ts`). */
export const WEB_VERSION = __APP_VERSION__;

// A browser holding yesterday's bundle reports yesterday's version confidently, and asking the
// server is the only way to notice. `/version`, so no database probe. Never retried.
export function useApiVersion(): UseQueryResult<VersionResponse> {
  return useQuery({
    queryKey: ['version'],
    queryFn: async () => versionResponseSchema.parse(await apiRequest('/version')),
    staleTime: Infinity,
    retry: false,
  });
}
