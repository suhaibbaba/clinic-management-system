import { authTokens } from "@web/shared/lib/auth-tokens";
import { ApiError, NetworkError } from "@web/shared/lib/api-error";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const REFRESH_PATH = "/auth/refresh";

let refreshInFlight: Promise<boolean> | null = null;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const url = `${API_BASE_URL}${path}`;

  if (!query) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const serialised = params.toString();
  return serialised ? `${url}?${serialised}` : url;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const token = authTokens.get();

  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }

  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      credentials: "same-origin",
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
      const response = await send(REFRESH_PATH, { method: "POST", body: {} });

      if (!response.ok) {
        return false;
      }

      const { accessToken } = (await response.json()) as { accessToken: string };
      authTokens.set(accessToken);
      return true;
    } catch {
      return false;
    } finally {
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

export async function apiStream(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const options: RequestOptions = { method: "POST", body, ...(signal && { signal }) };
  let response = await send(path, options);

  if (response.status === 401) {
    const refreshed = await refreshSession();

    if (!refreshed) {
      authTokens.notifySessionEnded();
      throw new ApiError(401);
    }

    response = await send(path, options);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await response.json().catch(() => undefined));
  }

  return response;
}

export async function apiDownload(path: string, query?: RequestOptions["query"]): Promise<Blob> {
  const options: RequestOptions = query ? { query } : {};
  let response = await send(path, options);

  if (response.status === 401) {
    const refreshed = await refreshSession();

    if (!refreshed) {
      authTokens.notifySessionEnded();
      throw new ApiError(401);
    }

    response = await send(path, options);
  }

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return response.blob();
}

export async function restoreSession(): Promise<boolean> {
  return refreshSession();
}
