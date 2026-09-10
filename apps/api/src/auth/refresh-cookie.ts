import type { CookieSerializeOptions } from '@fastify/cookie';
import type { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Env } from '@api/config/env.schema';

/**
 * Name of the httpOnly cookie carrying the refresh token.
 *
 * The browser never sees the refresh token in JavaScript: it is set by the API
 * and returned automatically on the refresh and logout calls, so an XSS on the
 * web app cannot read or exfiltrate it.
 */
export const REFRESH_COOKIE_NAME = 'clinic_refresh_token';

/** Reads the refresh token from the cookie, falling back to a request body. */
export function readRefreshToken(
  request: FastifyRequest,
  fromBody: string | undefined,
): string | undefined {
  const cookies = (request as FastifyRequest & { cookies?: Record<string, string | undefined> })
    .cookies;

  return cookies?.[REFRESH_COOKIE_NAME] ?? fromBody;
}

/** Everything the `Secure`/`SameSite` decision depends on, and nothing else. */
export interface RefreshCookieContext {
  readonly mode: Env['AUTH_COOKIE_SECURE'];
  readonly sameSite: Env['AUTH_COOKIE_SAMESITE'];
  readonly production: boolean;
  /**
   * The scheme the *browser* used — `request.protocol`, which reads
   * `X-Forwarded-Proto` because the adapter trusts the proxies in front of it
   * (see `createFastifyAdapter`). The API's own hop says nothing useful: it is
   * plain http inside the Docker network in every deployment.
   */
  readonly clientProtocol: string;
}

/**
 * Resolves the two attributes that decide whether the browser keeps the cookie.
 *
 * Kept pure and separate from the reply so the whole matrix — environment,
 * forwarded scheme, and the pair of settings — is a table in a unit test rather
 * than something only a deployed stack can demonstrate. The failure it exists
 * to prevent is silent: a browser that drops a `Secure` cookie sent to an http
 * page does not report anything, it simply signs the user out on every reload.
 */
export function refreshCookieSecurity(context: RefreshCookieContext): {
  secure: boolean;
  sameSite: Env['AUTH_COOKIE_SAMESITE'];
} {
  const secure =
    context.mode === 'always' ||
    (context.mode === 'auto' && (context.production || context.clientProtocol === 'https'));

  // `SameSite=None` without `Secure` is rejected outright by every current
  // browser, so the pair is reconciled here rather than sent out to be dropped.
  if (context.sameSite === 'none') {
    return secure ? { secure, sameSite: 'none' } : { secure, sameSite: 'lax' };
  }

  return { secure, sameSite: context.sameSite };
}

/**
 * The cookie's attributes for this request.
 *
 * `clearCookie` has to be given the same ones as `setCookie`: a browser matches
 * the expiry it is sent against name, domain and path, and an attribute that
 * differs leaves the original cookie in place — a logout that does not log out.
 */
function refreshCookieOptions(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
): CookieSerializeOptions {
  const { secure, sameSite } = refreshCookieSecurity({
    mode: config.get('AUTH_COOKIE_SECURE', { infer: true }),
    sameSite: config.get('AUTH_COOKIE_SAMESITE', { infer: true }),
    production: config.get('NODE_ENV', { infer: true }) === 'production',
    clientProtocol: reply.request.protocol,
  });

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: config.get('AUTH_COOKIE_PATH', { infer: true }),
  };
}

export function setRefreshCookie(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
  token: string,
): void {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions(reply, config),
    maxAge: config.get('JWT_REFRESH_TTL_DAYS', { infer: true }) * 24 * 60 * 60,
  });
}

export function clearRefreshCookie(reply: FastifyReply, config: ConfigService<Env, true>): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(reply, config));
}
