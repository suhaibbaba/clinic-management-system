import { healthResponseSchema, type HealthResponse } from '@clinic/shared';

/**
 * Same-origin API path in every environment: the Vite dev server proxies `/api`
 * to the API container, nginx proxies it in production. Override only when the
 * API is served from a different host.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    ...init,
  });

  if (!response.ok) {
    // The backend returns { statusCode, message, error }; Arabic copy is
    // resolved on this side by code, never from backend strings (CLAUDE.md).
    throw new ApiError(`Request to ${path} failed`, response.status);
  }

  return response.json();
}

/** Parsed with the same shared schema the API validates its response against. */
export async function fetchHealth(): Promise<HealthResponse> {
  return healthResponseSchema.parse(await apiFetch('/health'));
}
