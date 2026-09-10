import type { Paginated, PaginationQuery } from '@clinic/shared';

export function toLimitOffset(query: PaginationQuery): { limit: number; offset: number } {
  return { limit: query.limit, offset: (query.page - 1) * query.limit };
}

export function toPaginated<TItem>(
  items: TItem[],
  total: number,
  query: PaginationQuery,
): Paginated<TItem> {
  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}
