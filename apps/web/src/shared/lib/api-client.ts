import { authTokens } from "@web/shared/lib/auth-tokens";
import { ApiError, NetworkError } from "@web/shared/lib/api-error";
import { SESSION_RESTORE_RETRY_MS } from "@web/shared/constants/session";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const REFRESH_PATH = "/auth/refresh";

type RefreshOutcome = "refreshed" | "signed-out" | "unreachable";

let refreshInFlight: Promise<RefreshOutcome> | null = null;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const url = apiUrl(path);

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
async function refreshSession(): Promise<RefreshOutcome> {
  refreshInFlight ??= (async (): Promise<RefreshOutcome> => {
    try {
      const response = await send(REFRESH_PATH, { method: "POST", body: {} });

      if (response.status >= 500) {
        return "unreachable";
      }

      if (!response.ok) {
        return "signed-out";
      }

      const { accessToken } = (await response.json()) as { accessToken: string };
      authTokens.set(accessToken);
      return "refreshed";
    } catch {
      return "unreachable";
    } finally {
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

async function refreshOrEnd(): Promise<void> {
  const outcome = await refreshSession();

  if (outcome === "unreachable") {
    throw new NetworkError();
  }

  if (outcome === "signed-out") {
    authTokens.notifySessionEnded();
    throw new ApiError(401);
  }
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
    await refreshOrEnd();

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
    await refreshOrEnd();

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
    await refreshOrEnd();

    response = await send(path, options);
  }

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return response.blob();
}

export async function restoreSession(): Promise<boolean> {
  for (const delay of [...SESSION_RESTORE_RETRY_MS, undefined]) {
    const outcome = await refreshSession();

    if (outcome !== "unreachable" || delay === undefined) {
      return outcome === "refreshed";
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return false;
}
