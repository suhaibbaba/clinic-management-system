import type { CookieSerializeOptions } from "@fastify/cookie";
import type { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "@api/config/env.schema";

export const REFRESH_COOKIE_NAME = "clinic_refresh_token";

export function readRefreshToken(
  request: FastifyRequest,
  fromBody: string | undefined,
): string | undefined {
  const cookies = (request as FastifyRequest & { cookies?: Record<string, string | undefined> })
    .cookies;

  return cookies?.[REFRESH_COOKIE_NAME] ?? fromBody;
}

export interface RefreshCookieContext {
  readonly mode: Env["AUTH_COOKIE_SECURE"];
  readonly sameSite: Env["AUTH_COOKIE_SAMESITE"];
  readonly production: boolean;
  readonly clientProtocol: string;
}

export function refreshCookieSecurity(context: RefreshCookieContext): {
  secure: boolean;
  sameSite: Env["AUTH_COOKIE_SAMESITE"];
} {
  const secure =
    context.mode === "always" ||
    (context.mode === "auto" && (context.production || context.clientProtocol === "https"));

  if (context.sameSite === "none") {
    return secure ? { secure, sameSite: "none" } : { secure, sameSite: "lax" };
  }

  return { secure, sameSite: context.sameSite };
}

function refreshCookieOptions(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
): CookieSerializeOptions {
  const { secure, sameSite } = refreshCookieSecurity({
    mode: config.get("AUTH_COOKIE_SECURE", { infer: true }),
    sameSite: config.get("AUTH_COOKIE_SAMESITE", { infer: true }),
    production: config.get("NODE_ENV", { infer: true }) === "production",
    clientProtocol: reply.request.protocol,
  });

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: config.get("AUTH_COOKIE_PATH", { infer: true }),
  };
}

export function setRefreshCookie(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
  token: string,
): void {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions(reply, config),
    maxAge: config.get("JWT_REFRESH_TTL_DAYS", { infer: true }) * 24 * 60 * 60,
  });
}

export function clearRefreshCookie(reply: FastifyReply, config: ConfigService<Env, true>): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(reply, config));
}
