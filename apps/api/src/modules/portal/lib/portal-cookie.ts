import type { CookieSerializeOptions } from "@fastify/cookie";
import type { ConfigService } from "@nestjs/config";
import type { FastifyReply } from "fastify";
import { secureCookie } from "@api/common/lib/cookie-security";
import type { Env } from "@api/config/env.schema";
import { PORTAL_COOKIE_NAME } from "@api/modules/portal/constants";

function portalCookieOptions(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookie(
      config.get("AUTH_COOKIE_SECURE", { infer: true }),
      config.get("NODE_ENV", { infer: true }) === "production",
      reply.request.protocol,
    ),
    path: config.get("AUTH_COOKIE_PATH", { infer: true }),
  };
}

export function setPortalCookie(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
  token: string,
  expiresAt: Date,
): void {
  reply.setCookie(PORTAL_COOKIE_NAME, token, {
    ...portalCookieOptions(reply, config),
    expires: expiresAt,
  });
}

export function clearPortalCookie(reply: FastifyReply, config: ConfigService<Env, true>): void {
  reply.clearCookie(PORTAL_COOKIE_NAME, portalCookieOptions(reply, config));
}
