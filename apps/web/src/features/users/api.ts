import type {
  CreateUserInput,
  ListUsersQuery,
  Paginated,
  PresignUserPhotoInput,
  PresignUserPhotoResponse,
  ResetUserPasswordInput,
  UpdateUserInput,
  User,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

export const usersApi = {
  list: (query: Partial<ListUsersQuery>): Promise<Paginated<User>> =>
    apiRequest('/users', {
      query: {
        page: query.page,
        limit: query.limit,
        role: query.role,
        search: query.search,
        ...(query.isActive !== undefined && { isActive: query.isActive }),
      },
    }),

  create: (body: CreateUserInput): Promise<User> => apiRequest('/users', { method: 'POST', body }),

  update: (id: string, body: UpdateUserInput): Promise<User> =>
    apiRequest(`/users/${id}`, { method: 'PATCH', body }),

  resetPassword: (id: string, body: ResetUserPasswordInput): Promise<void> =>
    apiRequest(`/users/${id}/reset-password`, { method: 'POST', body }),

  presignPhoto: (id: string, body: PresignUserPhotoInput): Promise<PresignUserPhotoResponse> =>
    apiRequest(`/users/${id}/photo/presign`, { method: 'POST', body }),

  confirmPhoto: (id: string, key: string): Promise<User> =>
    apiRequest(`/users/${id}/photo`, { method: 'POST', body: { key } }),

  removePhoto: (id: string): Promise<User> =>
    apiRequest(`/users/${id}/photo`, { method: 'DELETE' }),
};
