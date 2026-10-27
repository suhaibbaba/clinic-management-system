import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { LoginResponse, Passkey, VerifyPasskeyLoginInput } from "@clinic/shared";
import { authApi } from "@web/shared/api/auth";

export async function signInWithPasskey(
  rememberMe: boolean,
  autofill = false,
): Promise<LoginResponse> {
  const { challengeId, options } = await authApi.passkeyOptions();
  const response = await startAuthentication({
    optionsJSON: options,
    useBrowserAutofill: autofill,
  });

  return authApi.verifyPasskey({
    challengeId,
    response: response as unknown as VerifyPasskeyLoginInput["response"],
    rememberMe,
  });
}

export async function createPasskey(name: string): Promise<Passkey> {
  const { challengeId, options } = await authApi.passkeyRegistrationOptions();
  const response = await startRegistration({ optionsJSON: options });

  return authApi.registerPasskey({
    challengeId,
    name,
    response: response as unknown as VerifyPasskeyLoginInput["response"],
  });
}

export function isPasskeyCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === "NotAllowedError";
}

export function isPasskeyAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
