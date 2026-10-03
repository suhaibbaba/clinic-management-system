import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { GOOGLE_AUTHORIZE_URL, GOOGLE_ISSUERS } from "@api/modules/auth/constants";

export interface GoogleOAuthState {
  readonly state: string;
  readonly verifier: string;
  readonly persistent: boolean;
}

export interface GoogleIdentity {
  readonly email: string;
}

const idTokenClaimsSchema = z.object({
  iss: z.enum(GOOGLE_ISSUERS),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
  email: z.email(),
  email_verified: z.union([z.literal(true), z.literal("true")]),
});

export function newGoogleOAuthState(persistent: boolean): GoogleOAuthState {
  return {
    state: randomBytes(24).toString("base64url"),
    verifier: randomBytes(48).toString("base64url"),
    persistent,
  };
}

export function serializeGoogleOAuthState(value: GoogleOAuthState): string {
  return `${value.state}.${value.verifier}.${value.persistent ? "1" : "0"}`;
}

export function parseGoogleOAuthState(cookie: string | undefined): GoogleOAuthState | undefined {
  const [state, verifier, remember, ...rest] = cookie?.split(".") ?? [];

  return state && verifier && (remember === "1" || remember === "0") && rest.length === 0
    ? { state, verifier, persistent: remember === "1" }
    : undefined;
}

export function sameGoogleState(expected: string, given: string): boolean {
  const want = Buffer.from(expected);
  const got = Buffer.from(given);

  return want.length === got.length && timingSafeEqual(want, got);
}

export function googleAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  value: GoogleOAuthState,
): string {
  const url = new URL(GOOGLE_AUTHORIZE_URL);

  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state: value.state,
    code_challenge: createHash("sha256").update(value.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  return url.toString();
}

// Reads claims without checking the signature: only valid for an ID token received directly from
// Google's token endpoint over TLS (OpenID Connect Core 3.1.3.7). Never pass a client-supplied token.
export function googleIdentityFromTokenEndpoint(
  idToken: string,
  clientId: string,
  now: number = Date.now(),
): GoogleIdentity | undefined {
  const payload = idToken.split(".")[1];

  if (!payload) {
    return undefined;
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }

  const claims = idTokenClaimsSchema.safeParse(decoded);

  if (!claims.success) {
    return undefined;
  }

  const audiences = Array.isArray(claims.data.aud) ? claims.data.aud : [claims.data.aud];

  if (!audiences.includes(clientId) || claims.data.exp * 1000 <= now) {
    return undefined;
  }

  return { email: claims.data.email.toLowerCase() };
}
