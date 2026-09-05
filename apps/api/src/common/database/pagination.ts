import type { Paginated, PaginationQuery } from '@clinic/shared';

/** Translates a validated `page`/`limit` pair into SQL limit/offset. */
export function toLimitOffset(query: PaginationQuery): { limit: number; offset: number } {
  return { limit: query.limit, offset: (query.page - 1) * query.limit };
}

/** Wraps a page of rows in the envelope every list endpoint returns. */
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
