import type { Env } from "@api/config/env.schema";

export function secureCookie(
  mode: Env["AUTH_COOKIE_SECURE"],
  production: boolean,
  clientProtocol: string,
): boolean {
  return mode === "always" || (mode === "auto" && (production || clientProtocol === "https"));
}
