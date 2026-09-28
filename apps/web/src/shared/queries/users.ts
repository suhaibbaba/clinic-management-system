import type { ListUsersQuery, Paginated, User } from "@clinic/shared";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { USERS_KEY } from "@web/shared/constants/query-keys";
import { listUsers } from "@web/shared/api/users";

export function useUsers(query: Partial<ListUsersQuery>): UseQueryResult<Paginated<User>> {
  return useQuery({
    queryKey: [USERS_KEY, query],
    queryFn: () => listUsers(query),
    placeholderData: (previous) => previous,
  });
}
