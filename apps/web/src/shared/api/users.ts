import type { ListUsersQuery, User, Paginated } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const listUsers = (query: Partial<ListUsersQuery>): Promise<Paginated<User>> =>
  apiRequest("/users", {
    query: {
      page: query.page,
      limit: query.limit,
      role: query.role,
      search: query.search,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    },
  });
