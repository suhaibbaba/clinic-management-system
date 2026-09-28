import type {
  AuthenticatedUserProfile,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LoginResponse,
  RequestLoginCodeInput,
  SetPasswordInput,
  UpdateOwnProfileInput,
  VerifyLoginCodeInput,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const authApi = {
  login: (body: LoginInput): Promise<LoginResponse> =>
    apiRequest("/auth/login", { method: "POST", body }),

  requestLoginCode: (body: RequestLoginCodeInput): Promise<void> =>
    apiRequest("/auth/login-code", { method: "POST", body }),

  verifyLoginCode: (body: VerifyLoginCodeInput): Promise<LoginResponse> =>
    apiRequest("/auth/login-code/verify", { method: "POST", body }),

  logout: (): Promise<void> => apiRequest("/auth/logout", { method: "POST", body: {} }),

  setPassword: (body: SetPasswordInput): Promise<void> =>
    apiRequest("/auth/set-password", { method: "POST", body }),

  forgotPassword: (body: ForgotPasswordInput): Promise<void> =>
    apiRequest("/auth/forgot-password", { method: "POST", body }),

  me: (): Promise<AuthenticatedUserProfile> => apiRequest("/me"),

  updateProfile: (body: UpdateOwnProfileInput): Promise<AuthenticatedUserProfile> =>
    apiRequest("/me", { method: "PATCH", body }),

  changePassword: (body: ChangePasswordInput): Promise<void> =>
    apiRequest("/me/change-password", { method: "POST", body }),
};
