import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type GoogleCallbackQuery } from "@clinic/shared";
import { type Env } from "@api/config/env.schema";
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_TOKEN_TIMEOUT_MS,
  GOOGLE_TOKEN_URL,
} from "@api/modules/auth/constants";
import {
  googleAuthorizeUrl,
  googleIdentityFromTokenEndpoint,
  newGoogleOAuthState,
  parseGoogleOAuthState,
  sameGoogleState,
  serializeGoogleOAuthState,
  type GoogleIdentity,
} from "@api/modules/auth/lib/google-oauth";

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return this.credentials() !== undefined;
  }

  begin(persistent: boolean): { url: string; cookie: string } | undefined {
    const credentials = this.credentials();

    if (!credentials) {
      return undefined;
    }

    const state = newGoogleOAuthState(persistent);

    return {
      url: googleAuthorizeUrl(credentials.clientId, this.redirectUri(), state),
      cookie: serializeGoogleOAuthState(state),
    };
  }

  async finish(
    query: GoogleCallbackQuery,
    cookie: string | undefined,
  ): Promise<(GoogleIdentity & { readonly persistent: boolean }) | undefined> {
    const credentials = this.credentials();
    const expected = parseGoogleOAuthState(cookie);

    if (
      !credentials ||
      !expected ||
      !query.code ||
      !query.state ||
      !sameGoogleState(expected.state, query.state)
    ) {
      return undefined;
    }

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: query.code,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          redirect_uri: this.redirectUri(),
          grant_type: "authorization_code",
          code_verifier: expected.verifier,
        }),
        signal: AbortSignal.timeout(GOOGLE_TOKEN_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`Google refused the sign-in code: ${response.status}`);
        return undefined;
      }

      const { id_token: idToken } = (await response.json()) as { id_token?: unknown };

      const identity =
        typeof idToken === "string"
          ? googleIdentityFromTokenEndpoint(idToken, credentials.clientId)
          : undefined;

      return identity && { ...identity, persistent: expected.persistent };
    } catch (error) {
      this.logger.warn(`Could not reach Google to finish a sign-in: ${String(error)}`);
      return undefined;
    }
  }

  private credentials(): { clientId: string; clientSecret: string } | undefined {
    const clientId = this.config.get("GOOGLE_CLIENT_ID", { infer: true });
    const clientSecret = this.config.get("GOOGLE_CLIENT_SECRET", { infer: true });

    return clientId && clientSecret ? { clientId, clientSecret } : undefined;
  }

  private redirectUri(): string {
    return (
      this.config.get("GOOGLE_REDIRECT_URI", { infer: true }) ??
      new URL(GOOGLE_CALLBACK_PATH, this.config.get("PUBLIC_BASE_URL", { infer: true })).toString()
    );
  }
}
