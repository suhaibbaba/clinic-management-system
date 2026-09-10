import type { CookieSerializeOptions } from '@fastify/cookie';
import type { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Env } from '@api/config/env.schema';

/** Set by the API and never readable from JavaScript, so an XSS on the web app cannot exfiltrate it. */
export const REFRESH_COOKIE_NAME = 'clinic_refresh_token';

export function readRefreshToken(
  request: FastifyRequest,
  fromBody: string | undefined,
): string | undefined {
  const cookies = (request as FastifyRequest & { cookies?: Record<string, string | undefined> })
    .cookies;

  return cookies?.[REFRESH_COOKIE_NAME] ?? fromBody;
}

export interface RefreshCookieContext {
  readonly mode: Env['AUTH_COOKIE_SECURE'];
  readonly sameSite: Env['AUTH_COOKIE_SAMESITE'];
  readonly production: boolean;
  // The scheme the browser used, via `X-Forwarded-Proto` — the API's own hop is plain http inside
  // the Docker network in every deployment.
  readonly clientProtocol: string;
}

// Pure and separate from the reply so the whole matrix is a unit test: a browser that drops a
// `Secure` cookie sent to an http page reports nothing, it just signs the user out on every reload.
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

// `clearCookie` must be given the same attributes as `setCookie` — a browser that matches on name,
// domain and path leaves the original in place otherwise.
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
