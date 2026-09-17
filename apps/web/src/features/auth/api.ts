import type {
  AuthenticatedUserProfile,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LoginResponse,
  SetPasswordInput,
  UpdateOwnProfileInput,
} from "@clinic/shared";

import { apiRequest } from "@web/lib/api-client";

export const authApi = {
  login: (body: LoginInput): Promise<LoginResponse> =>
    apiRequest("/auth/login", { method: "POST", body }),

  /** The refresh token lives in an httpOnly cookie, so the body is empty. */
  logout: (): Promise<void> => apiRequest("/auth/logout", { method: "POST", body: {} }),

  /** Both letters end here — the token says which account, and whether it was ever activated. */
  setPassword: (body: SetPasswordInput): Promise<void> =>
    apiRequest("/auth/set-password", { method: "POST", body }),

  /** Answers the same whether or not the address is known here, so nothing is learned by asking. */
  forgotPassword: (body: ForgotPasswordInput): Promise<void> =>
    apiRequest("/auth/forgot-password", { method: "POST", body }),

  me: (): Promise<AuthenticatedUserProfile> => apiRequest("/me"),

  updateProfile: (body: UpdateOwnProfileInput): Promise<AuthenticatedUserProfile> =>
    apiRequest("/me", { method: "PATCH", body }),

  changePassword: (body: ChangePasswordInput): Promise<void> =>
    apiRequest("/me/change-password", { method: "POST", body }),
};
