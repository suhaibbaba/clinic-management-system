import { listUsers, sendPasswordReset } from "@web/shared/api/users";
import type {
  CreateUserInput,
  PresignUserPhotoInput,
  PresignUserPhotoResponse,
  ResetUserPasswordInput,
  UpdateUserInput,
  User,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const usersApi = {
  list: listUsers,

  create: (body: CreateUserInput): Promise<User> => apiRequest("/users", { method: "POST", body }),

  get: (id: string): Promise<User> => apiRequest(`/users/${id}`),

  update: (id: string, body: UpdateUserInput): Promise<User> =>
    apiRequest(`/users/${id}`, { method: "PATCH", body }),

  invite: (id: string): Promise<void> =>
    apiRequest(`/users/${id}/invite`, { method: "POST", body: {} }),

  resetPassword: (id: string, body: ResetUserPasswordInput): Promise<void> =>
    apiRequest(`/users/${id}/reset-password`, { method: "POST", body }),

  sendPasswordReset,

  remove: (id: string): Promise<void> => apiRequest(`/users/${id}`, { method: "DELETE" }),

  presignPhoto: (id: string, body: PresignUserPhotoInput): Promise<PresignUserPhotoResponse> =>
    apiRequest(`/users/${id}/photo/presign`, { method: "POST", body }),

  confirmPhoto: (id: string, key: string): Promise<User> =>
    apiRequest(`/users/${id}/photo`, { method: "POST", body: { key } }),

  removePhoto: (id: string): Promise<User> =>
    apiRequest(`/users/${id}/photo`, { method: "DELETE" }),
};
