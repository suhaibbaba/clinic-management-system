import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AuditLogEntry, ListAuditLogQuery, Paginated } from '@clinic/shared';

import { auditApi } from '@web/features/audit/api';

export function useAuditLog(
  query: Partial<ListAuditLogQuery>,
): UseQueryResult<Paginated<AuditLogEntry>> {
  return useQuery({
    queryKey: ['audit-log', query],
    queryFn: () => auditApi.list(query),
    placeholderData: (previous) => previous,
  });
}
