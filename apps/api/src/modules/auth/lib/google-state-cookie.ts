import type { CookieSerializeOptions } from "@fastify/cookie";
import type { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "@api/config/env.schema";
import { GOOGLE_STATE_COOKIE, GOOGLE_STATE_TTL_SECONDS } from "@api/modules/auth/constants";
import { refreshCookieSecurity } from "@api/modules/auth/lib/refresh-cookie";

function googleStateCookieOptions(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
): CookieSerializeOptions {
  const { secure } = refreshCookieSecurity({
    mode: config.get("AUTH_COOKIE_SECURE", { infer: true }),
    sameSite: "lax",
    production: config.get("NODE_ENV", { infer: true }) === "production",
    clientProtocol: reply.request.protocol,
  });

  return { httpOnly: true, sameSite: "lax", secure, path: "/" };
}

export function setGoogleStateCookie(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
  value: string,
): void {
  reply.setCookie(GOOGLE_STATE_COOKIE, value, {
    ...googleStateCookieOptions(reply, config),
    maxAge: GOOGLE_STATE_TTL_SECONDS,
  });
}

export function takeGoogleStateCookie(
  request: FastifyRequest,
  reply: FastifyReply,
  config: ConfigService<Env, true>,
): string | undefined {
  const cookies = (request as FastifyRequest & { cookies?: Record<string, string | undefined> })
    .cookies;

  reply.clearCookie(GOOGLE_STATE_COOKIE, googleStateCookieOptions(reply, config));

  return cookies?.[GOOGLE_STATE_COOKIE];
}
