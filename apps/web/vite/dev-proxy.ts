import type { IncomingMessage } from 'node:http';

import type { ProxyOptions } from 'vite';

/** Where `/api` goes when nothing says otherwise: the API of the dev stack. */
export const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000';

/**
 * Rewrites one `Set-Cookie` for a browser that is talking plain http.
 *
 * The dev server is http on localhost; the target may be https. A cookie the
 * API marked `Secure` is then set over a connection the browser does not
 * consider secure, and while Chrome and Firefox make an exception for localhost
 * Safari does not — so the cookie is simply never stored, and every reload
 * lands back on the login screen with nothing in the console to explain it.
 *
 * `SameSite=None` goes with it: browsers only accept it alongside `Secure`, so
 * dropping one without the other would trade a cookie that is refused for a
 * cookie that is refused. Everything through this proxy is same-origin as far
 * as the browser is concerned, which is what `Lax` describes.
 */
export function cookieForInsecureOrigin(setCookie: string): string {
  return setCookie
    .split(';')
    .filter((attribute) => attribute.trim().toLowerCase() !== 'secure')
    .map((attribute) =>
      /^\s*samesite\s*=\s*none\s*$/i.test(attribute)
        ? attribute.replace(/none\s*$/i, 'Lax')
        : attribute,
    )
    .join(';');
}

/** Whether the *browser's* hop into the dev server is encrypted. */
function isEncrypted(request: IncomingMessage): boolean {
  return 'encrypted' in request.socket && request.socket.encrypted === true;
}

/**
 * Same-origin `/api` in dev and in preview; nginx does it in production.
 *
 * The target is usually the API of the local stack, but `API_PROXY_TARGET` can
 * point it at a remote one — a sandbox over https, say, with only the frontend
 * running on the laptop. That is where the httpOnly refresh cookie needs help:
 * it is set by an origin the browser never sees, so every attribute the API
 * wrote is about the wrong host, the wrong scheme and the wrong path.
 *
 *   - `cookieDomainRewrite: ''` drops the `Domain`, leaving the cookie scoped
 *     to whatever host the browser asked — localhost.
 *   - `cookiePathRewrite: '/'` re-anchors it. The API sets the path it sees
 *     (`AUTH_COOKIE_PATH`, against `/auth/refresh`); the browser asks for
 *     `/api/auth/refresh`, because `rewrite` strips the prefix on the way out.
 *     A cookie at `/auth` would be held and never sent.
 *   - `xfwd: true` tells the API which scheme the browser used, rather than
 *     leaving it to conclude https from this hop and mark the cookie `Secure`.
 *   - and the `Secure` already on the response is stripped, because a remote
 *     target's own configuration is not ours to change from here.
 */
export function apiProxy(
  target: string = process.env['API_PROXY_TARGET'] ?? DEFAULT_API_PROXY_TARGET,
): Record<string, ProxyOptions> {
  return {
    // Keeping the API same-origin is what lets the httpOnly refresh cookie
    // work without CORS credentials.
    '/api': {
      target,
      changeOrigin: true,
      xfwd: true,
      cookieDomainRewrite: '',
      cookiePathRewrite: '/',
      rewrite: (path: string) => path.replace(/^\/api/, ''),
      configure(proxy) {
        proxy.on('proxyRes', (proxyResponse, request) => {
          const setCookie = proxyResponse.headers['set-cookie'];

          if (!setCookie || isEncrypted(request)) {
            return;
          }

          proxyResponse.headers['set-cookie'] = setCookie.map(cookieForInsecureOrigin);
        });
      },
    },
  };
}
