import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { LoginResponse, Passkey, VerifyPasskeyLoginInput } from "@clinic/shared";
import { authApi } from "@web/shared/api/auth";

export async function signInWithPasskey(): Promise<LoginResponse> {
  const { challengeId, options } = await authApi.passkeyOptions();
  const response = await startAuthentication({ optionsJSON: options });

  return authApi.verifyPasskey({
    challengeId,
    response: response as unknown as VerifyPasskeyLoginInput["response"],
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
