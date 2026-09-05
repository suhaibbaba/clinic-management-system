import type {
  AuthenticatedUserProfile,
  ChangePasswordInput,
  LoginInput,
  LoginResponse,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

export const authApi = {
  login: (body: LoginInput): Promise<LoginResponse> =>
    apiRequest('/auth/login', { method: 'POST', body }),

  /** The refresh token lives in an httpOnly cookie, so the body is empty. */
  logout: (): Promise<void> => apiRequest('/auth/logout', { method: 'POST', body: {} }),

  me: (): Promise<AuthenticatedUserProfile> => apiRequest('/me'),

  changePassword: (body: ChangePasswordInput): Promise<void> =>
    apiRequest('/me/change-password', { method: 'POST', body }),
};
