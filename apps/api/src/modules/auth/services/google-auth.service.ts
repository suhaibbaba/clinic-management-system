import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type GoogleCallbackQuery } from "@clinic/shared";
import { type RequestSite } from "@api/common/types/request-site";
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
import { ClinicHostService } from "@api/modules/auth/services/clinic-host.service";
import { SecretsService } from "@api/modules/secrets/services/secrets.service";

interface GoogleClient {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly clinicId: string | null;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly hosts: ClinicHostService,
    private readonly secrets: SecretsService,
  ) {}

  async homeFor(site: RequestSite): Promise<string> {
    return (await this.hosts.clinicAt(site.host))
      ? site.origin
      : this.config.get("PUBLIC_BASE_URL", { infer: true });
  }

  async enabledAt(site: RequestSite): Promise<boolean> {
    return (await this.client(site)) !== undefined;
  }

  async begin(
    site: RequestSite,
    persistent: boolean,
  ): Promise<{ url: string; cookie: string } | undefined> {
    const client = await this.client(site);

    if (!client) {
      return undefined;
    }

    const state = newGoogleOAuthState(persistent);

    return {
      url: googleAuthorizeUrl(client.clientId, client.redirectUri, state),
      cookie: serializeGoogleOAuthState(state),
    };
  }

  async finish(
    site: RequestSite,
    query: GoogleCallbackQuery,
    cookie: string | undefined,
  ): Promise<
    | (GoogleIdentity & { readonly persistent: boolean; readonly clinicId: string | null })
    | undefined
  > {
    const client = await this.client(site);
    const expected = parseGoogleOAuthState(cookie);

    if (
      !client ||
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
          client_id: client.clientId,
          client_secret: client.clientSecret,
          redirect_uri: client.redirectUri,
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
          ? googleIdentityFromTokenEndpoint(idToken, client.clientId)
          : undefined;

      return (
        identity && { ...identity, persistent: expected.persistent, clinicId: client.clinicId }
      );
    } catch (error) {
      this.logger.warn(`Could not reach Google to finish a sign-in: ${String(error)}`);
      return undefined;
    }
  }

  private async client(site: RequestSite): Promise<GoogleClient | undefined> {
    const clinic = await this.hosts.clinicAt(site.host);

    if (clinic) {
      const clientSecret = clinic.googleClientId
        ? await this.secrets.googleClientSecret(clinic.id)
        : null;

      return clinic.googleClientId && clientSecret
        ? {
            clientId: clinic.googleClientId,
            clientSecret,
            redirectUri: new URL(GOOGLE_CALLBACK_PATH, site.origin).toString(),
            clinicId: clinic.id,
          }
        : undefined;
    }

    const clientId = this.config.get("GOOGLE_CLIENT_ID", { infer: true });
    const clientSecret = this.config.get("GOOGLE_CLIENT_SECRET", { infer: true });

    return clientId && clientSecret
      ? { clientId, clientSecret, redirectUri: this.defaultRedirectUri(), clinicId: null }
      : undefined;
  }

  private defaultRedirectUri(): string {
    return (
      this.config.get("GOOGLE_REDIRECT_URI", { infer: true }) ??
      new URL(GOOGLE_CALLBACK_PATH, this.config.get("PUBLIC_BASE_URL", { infer: true })).toString()
    );
  }
}
