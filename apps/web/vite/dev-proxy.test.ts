import { createServer as createHttpServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath, URL } from 'node:url';

import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { apiProxy, cookieForInsecureOrigin } from './dev-proxy.ts';

// The bug this exists for: `pnpm dev` against a remote https API signs in and every reload lands
// back on login. The mock writes the attributes that cause it.

const REFRESH_COOKIE = 'clinic_refresh_token';

/** What the deployed API's `Set-Cookie` looks like: https, behind nginx. */
const UPSTREAM_SET_COOKIE = `${REFRESH_COOKIE}=refresh-token-value; Domain=clinic.example; Path=/auth; HttpOnly; SameSite=Lax; Secure`;

interface Origin {
  readonly secure: boolean;
  readonly host: string;
}

interface StoredCookie {
  readonly value: string;
  readonly path: string;
}

// Strict about `Secure` on purpose: Chrome and Firefox make an exception for localhost, Safari does
// not, and a clinic's laptop is not ours to choose.
class CookieJar {
  private readonly cookies = new Map<string, StoredCookie>();

  store(setCookie: readonly string[], origin: Origin): void {
    for (const header of setCookie) {
      const [pair, ...rest] = header.split(';');
      const [name, ...valueParts] = (pair ?? '').split('=');
      const attributes = new Map(
        rest.map((attribute) => {
          const [key, ...value] = attribute.trim().split('=');
          return [(key ?? '').toLowerCase(), value.join('=')] as const;
        }),
      );

      if (!name) {
        continue;
      }

      if (attributes.has('secure') && !origin.secure) {
        continue;
      }

      const domain = attributes.get('domain');

      if (domain && domain.replace(/^\./, '') !== origin.host) {
        continue;
      }

      this.cookies.set(name.trim(), {
        value: valueParts.join('='),
        path: attributes.get('path') || '/',
      });
    }
  }

  header(path: string): string | undefined {
    const sent = [...this.cookies.entries()].filter(
      ([, cookie]) => path === cookie.path || path.startsWith(cookie.path.replace(/\/$/, '') + '/'),
    );

    return sent.length > 0
      ? sent.map(([name, cookie]) => `${name}=${cookie.value}`).join('; ')
      : undefined;
  }
}

interface UpstreamRequest {
  readonly url: string;
  readonly cookie: string | undefined;
  readonly forwardedProto: string | undefined;
}

const received: UpstreamRequest[] = [];

let upstream: Server;
let vite: ViteDevServer;
let devServerOrigin: string;

/** The API as it is deployed: it sets a production cookie and demands it back. */
function createUpstream(): Server {
  return createHttpServer((request, response) => {
    received.push({
      url: request.url ?? '',
      cookie: request.headers.cookie,
      forwardedProto: header(request, 'x-forwarded-proto'),
    });

    if (request.url === '/auth/login') {
      response.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': UPSTREAM_SET_COOKIE,
      });
      response.end(JSON.stringify({ accessToken: 'access-token-value' }));
      return;
    }

    if (request.url === '/auth/refresh') {
      // No cookie is what a browser does when it never stored one, and the app's answer to the 401
      // is the login screen — the symptom being tested.
      if (!request.headers.cookie?.includes(REFRESH_COOKIE)) {
        response.writeHead(401, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ statusCode: 401, message: 'Missing refresh token' }));
        return;
      }

      response.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': UPSTREAM_SET_COOKIE,
      });
      response.end(JSON.stringify({ accessToken: 'rotated-access-token' }));
      return;
    }

    response.writeHead(404).end();
  });
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];

  return Array.isArray(value) ? value[0] : value;
}

async function request(
  path: string,
  jar: CookieJar,
): Promise<{ status: number; setCookie: string[] }> {
  const cookie = jar.header(path);
  const response = await fetch(new URL(path, devServerOrigin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({}),
  });
  await response.text();

  return { status: response.status, setCookie: response.headers.getSetCookie() };
}

beforeAll(async () => {
  upstream = createUpstream();
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamPort = (upstream.address() as AddressInfo).port;

  vite = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    logLevel: 'silent',
    // The dev server is plain http, like `pnpm dev` on a laptop; the target
    // stands in for a remote deployment behind TLS.
    server: {
      host: '127.0.0.1',
      port: 0,
      proxy: apiProxy(`http://127.0.0.1:${upstreamPort}`),
    },
  });

  await vite.listen();
  const devPort = (vite.httpServer?.address() as AddressInfo).port;
  devServerOrigin = `http://127.0.0.1:${devPort}`;
});

afterAll(async () => {
  await vite.close();
  await new Promise<void>((resolve, reject) =>
    upstream.close((error) => (error ? reject(error) : resolve())),
  );
});

describe('the dev proxy and the refresh cookie', () => {
  it('keeps a session across a reload against a remote target', async () => {
    const jar = new CookieJar();
    const origin: Origin = { secure: false, host: '127.0.0.1' };

    const login = await request('/api/auth/login', jar);
    expect(login.status).toBe(200);

    jar.store(login.setCookie, origin);
    expect(jar.header('/api/auth/refresh')).toContain(REFRESH_COOKIE);

    // The reload: a new page, no memory, nothing but the cookie jar. The app
    // asks for a fresh access token before it renders anything.
    const refresh = await request('/api/auth/refresh', jar);

    expect(refresh.status).toBe(200);
    expect(received.at(-1)?.cookie).toContain(REFRESH_COOKIE);
    // The prefix belongs to the browser's origin, not to the API's routes.
    expect(received.at(-1)?.url).toBe('/auth/refresh');
  });

  it('tells the target which scheme the browser actually used', async () => {
    const jar = new CookieJar();

    await request('/api/auth/login', jar);

    // Without this the API sees only its own hop and decides `Secure` from the wrong scheme.
    expect(received.at(-1)?.forwardedProto).toBe('http');
  });

  it('is the proxy that makes the cookie usable, not the target', async () => {
    // The control: the upstream's own header is held for another host, refused for being `Secure`,
    // and scoped to a path the browser never asks for.
    const untouched = new CookieJar();
    untouched.store([UPSTREAM_SET_COOKIE], { secure: false, host: '127.0.0.1' });

    expect(untouched.header('/api/auth/refresh')).toBeUndefined();
  });
});

describe('cookieForInsecureOrigin', () => {
  it('drops Secure and leaves the rest of the cookie alone', () => {
    expect(cookieForInsecureOrigin(UPSTREAM_SET_COOKIE)).toBe(
      `${REFRESH_COOKIE}=refresh-token-value; Domain=clinic.example; Path=/auth; HttpOnly; SameSite=Lax`,
    );
  });

  it('downgrades SameSite=None, which no browser accepts without Secure', () => {
    expect(cookieForInsecureOrigin(`${REFRESH_COOKIE}=v; SameSite=None; Secure`)).toBe(
      `${REFRESH_COOKIE}=v; SameSite=Lax`,
    );
  });

  it('leaves a value that merely contains the word alone', () => {
    expect(cookieForInsecureOrigin(`${REFRESH_COOKIE}=secure-token; Path=/`)).toBe(
      `${REFRESH_COOKIE}=secure-token; Path=/`,
    );
  });
});
