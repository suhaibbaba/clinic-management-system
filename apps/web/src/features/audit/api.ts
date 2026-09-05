import type { AuditLogEntry, ListAuditLogQuery, Paginated } from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

export const auditApi = {
  list: (query: Partial<ListAuditLogQuery>): Promise<Paginated<AuditLogEntry>> =>
    apiRequest('/audit-log', {
      query: {
        page: query.page,
        limit: query.limit,
        entity: query.entity,
        userId: query.userId,
        action: query.action,
        from: query.from,
        to: query.to,
      },
    }),
};
