import type { CookieSerializeOptions } from "@fastify/cookie";
import type { ConfigService } from "@nestjs/config";
import type { FastifyReply } from "fastify";
import { secureCookie } from "@api/common/lib/cookie-security";
import type { Env } from "@api/config/env.schema";
import { VENDOR_COOKIE_NAME } from "@api/modules/vendor/constants";

function vendorCookieOptions(
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

export function setVendorCookie(
  reply: FastifyReply,
  config: ConfigService<Env, true>,
  token: string,
  expiresAt: Date,
): void {
  reply.setCookie(VENDOR_COOKIE_NAME, token, {
    ...vendorCookieOptions(reply, config),
    expires: expiresAt,
  });
}

export function clearVendorCookie(reply: FastifyReply, config: ConfigService<Env, true>): void {
  reply.clearCookie(VENDOR_COOKIE_NAME, vendorCookieOptions(reply, config));
}
