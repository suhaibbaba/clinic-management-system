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

export function setRefreshCookie(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
  token: string,
): void {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.get('NODE_ENV', { infer: true }) === 'production',
    path: config.get('AUTH_COOKIE_PATH', { infer: true }),
    maxAge: config.get('JWT_REFRESH_TTL_DAYS', { infer: true }) * 24 * 60 * 60,
  });
}

export function clearRefreshCookie(reply: FastifyReply, config: ConfigService<Env, true>): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.get('NODE_ENV', { infer: true }) === 'production',
    path: config.get('AUTH_COOKIE_PATH', { infer: true }),
  });
}
