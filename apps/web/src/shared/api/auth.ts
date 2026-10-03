import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import type {
  AuthMethods,
  AuthenticatedUserProfile,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LoginResponse,
  Passkey,
  PasskeyChallenge,
  RegisterPasskeyInput,
  RequestLoginCodeInput,
  SetPasswordInput,
  UpdateOwnProfileInput,
  VerifyLoginCodeInput,
  VerifyPasskeyLoginInput,
} from "@clinic/shared";
import { apiRequest, apiUrl } from "@web/shared/lib/api-client";

export const authApi = {
  login: (body: LoginInput): Promise<LoginResponse> =>
    apiRequest("/auth/login", { method: "POST", body }),

  requestLoginCode: (body: RequestLoginCodeInput): Promise<void> =>
    apiRequest("/auth/login-code", { method: "POST", body }),

  verifyLoginCode: (body: VerifyLoginCodeInput): Promise<LoginResponse> =>
    apiRequest("/auth/login-code/verify", { method: "POST", body }),

  methods: (): Promise<AuthMethods> => apiRequest("/auth/methods"),

  googleSignInUrl: (rememberMe: boolean): string =>
    apiUrl(rememberMe ? "/auth/google" : "/auth/google?remember=0"),

  passkeyOptions: (): Promise<PasskeyChallenge<PublicKeyCredentialRequestOptionsJSON>> =>
    apiRequest("/auth/passkey/options", { method: "POST", body: {} }),

  verifyPasskey: (body: VerifyPasskeyLoginInput): Promise<LoginResponse> =>
    apiRequest("/auth/passkey/verify", { method: "POST", body }),

  passkeys: (): Promise<Passkey[]> => apiRequest("/me/passkeys"),

  passkeyRegistrationOptions: (): Promise<
    PasskeyChallenge<PublicKeyCredentialCreationOptionsJSON>
  > => apiRequest("/me/passkeys/options", { method: "POST", body: {} }),

  registerPasskey: (body: RegisterPasskeyInput): Promise<Passkey> =>
    apiRequest("/me/passkeys", { method: "POST", body }),

  removePasskey: (id: string): Promise<void> =>
    apiRequest(`/me/passkeys/${id}`, { method: "DELETE" }),

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
