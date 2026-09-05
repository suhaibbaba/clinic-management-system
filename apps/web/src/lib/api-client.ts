import { authTokens } from '@web/lib/auth-tokens';
import { ApiError, NetworkError } from '@web/lib/api-error';

/**
 * Same-origin in every environment: Vite proxies `/api` in development, nginx
 * proxies it in production. Same-origin is also what lets the httpOnly refresh
 * cookie ride along without CORS credentials.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const REFRESH_PATH = '/auth/refresh';

/**
 * In flight refresh, shared by every request that hit a 401 at the same time,
 * so a burst of parallel queries triggers exactly one refresh.
 */
let refreshInFlight: Promise<boolean> | null = null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const url = `${API_BASE_URL}${path}`;

  if (!query) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const serialised = params.toString();
  return serialised ? `${url}?${serialised}` : url;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const token = authTokens.get();

  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }

  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      // Sends the httpOnly refresh cookie on same-origin calls.
      credentials: 'same-origin',
      ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
      ...(options.signal && { signal: options.signal }),
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }
}

/** Exchanges the refresh cookie for a new access token. At most one at a time. */
async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await send(REFRESH_PATH, { method: 'POST', body: {} });

      if (!response.ok) {
        return false;
      }

      const { accessToken } = (await response.json()) as { accessToken: string };
      authTokens.set(accessToken);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so concurrent callers all observe this result.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

async function parse<TResult>(response: Response): Promise<TResult> {
  if (response.status === 204) {
    return undefined as TResult;
  }

  return (await response.json()) as TResult;
}

/**
 * Performs a request, refreshing once on a 401 and replaying the original call.
 * A second 401 ends the session and the app routes back to the login screen.
 */
export async function apiRequest<TResult>(
  path: string,
  options: RequestOptions = {},
): Promise<TResult> {
  let response = await send(path, options);

  if (response.status === 401 && path !== REFRESH_PATH) {
    const refreshed = await refreshSession();

    if (!refreshed) {
      authTokens.notifySessionEnded();
      throw new ApiError(401);
    }

    response = await send(path, options);

    if (response.status === 401) {
      authTokens.notifySessionEnded();
      throw new ApiError(401);
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await response.json().catch(() => undefined));
  }

  return parse<TResult>(response);
}

/** Restores a session on a cold page load. Safe to call when signed out. */
export async function restoreSession(): Promise<boolean> {
  return refreshSession();
}
