import { healthResponseSchema, type HealthResponse } from '@clinic/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiRequest } from '@web/lib/api-client';

/**
 * What version the API is actually running.
 *
 * The bundle carries its own `APP_VERSION`, baked in at build time, and that
 * is the number the settings screen shows. This is the other half: a browser
 * holding yesterday's bundle after a deploy will report yesterday's version
 * quite confidently, and the only way to notice is to ask the server what it
 * thinks. `/health` is public and already carries it.
 *
 * Never retried and cached for the session: this is a footnote, and a settings
 * page that spins because a footnote is slow would be a worse page.
 */
export function useApiVersion(): UseQueryResult<HealthResponse> {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => healthResponseSchema.parse(await apiRequest('/health')),
    staleTime: Infinity,
    retry: false,
  });
}
