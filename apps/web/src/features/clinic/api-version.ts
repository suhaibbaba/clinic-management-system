import { versionResponseSchema, type VersionResponse } from '@clinic/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiRequest } from '@web/lib/api-client';

/** This bundle's version, fixed when it was built (`vite.config.ts`). */
export const WEB_VERSION = __APP_VERSION__;

/**
 * What version the API is actually running.
 *
 * Both numbers come from the same deploy, so they agree — until they do not,
 * and the case where they do not is the one worth showing: a browser holding
 * yesterday's bundle after a deploy will report yesterday's version quite
 * confidently, and asking the server is the only way to notice.
 *
 * `/version` rather than `/health`: this is one string, and a settings screen
 * should not run a database probe to read it.
 *
 * Never retried and cached for the session — a footnote that spins would be a
 * worse footnote.
 */
export function useApiVersion(): UseQueryResult<VersionResponse> {
  return useQuery({
    queryKey: ['version'],
    queryFn: async () => versionResponseSchema.parse(await apiRequest('/version')),
    staleTime: Infinity,
    retry: false,
  });
}
