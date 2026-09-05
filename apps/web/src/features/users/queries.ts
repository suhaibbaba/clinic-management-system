import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreateUserInput,
  ListUsersQuery,
  Paginated,
  UpdateUserInput,
  User,
} from '@clinic/shared';

import { usersApi } from '@web/features/users/api';

const USERS_KEY = 'users';

export function useUsers(query: Partial<ListUsersQuery>): UseQueryResult<Paginated<User>> {
  return useQuery({
    queryKey: [USERS_KEY, query],
    queryFn: () => usersApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateUserInput) => usersApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserInput }) => usersApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      usersApi.resetPassword(id, { newPassword }),
  });
}
