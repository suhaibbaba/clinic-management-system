import type { IncomingMessage } from 'node:http';

import type { ProxyOptions } from 'vite';

export const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000';

// The dev server is http and the target may be https: Safari refuses to store a `Secure` cookie
// there at all. `SameSite=None` goes with it, since browsers only accept it alongside `Secure`.
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

function isEncrypted(request: IncomingMessage): boolean {
  return 'encrypted' in request.socket && request.socket.encrypted === true;
}

// A remote target sets the cookie for the wrong host, scheme and path: the `Domain` is dropped, the
// path re-anchored to `/`, `xfwd` reports the real scheme, and `Secure` is stripped.
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
